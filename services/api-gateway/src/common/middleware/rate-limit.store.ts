import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisCounterService } from '../redis/redis-counter.service';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface IncrementResult {
  count: number;
  resetAt: number;
  resetInMs: number;
}

/**
 * Sliding/fixed-window rate-limit counter shared by the IP/user middleware and
 * the per-tenant guard.
 *
 * Debt #6: the counters are Redis-backed (via {@link RedisCounterService}) so
 * limits hold ACROSS replicas and survive a deploy, with an in-memory fallback
 * when Redis is down. Redis keys carry a TTL == the window, so Redis
 * self-expires them — the old `setInterval` sweep is gone.
 *
 * The public `increment(key, windowMs)` API stays SYNCHRONOUS so the middleware
 * (which runs in Express's sync `use`) and the guard don't change: it returns
 * the local window count immediately and reconciles with the shared Redis
 * counter in the background, so a replica converges to the cross-instance total
 * on the next request. When Redis is unavailable it behaves exactly like the
 * previous in-memory store.
 */
@Injectable()
export class RateLimitStore {
  private readonly logger = new Logger(RateLimitStore.name);
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly prefix = 'rl:';

  constructor(@Optional() private readonly counter?: RedisCounterService) {}

  increment(key: string, windowMs: number): IncrementResult {
    const now = Date.now();
    const entry = this.store.get(key);

    let local: RateLimitEntry;
    let firstInWindow = false;
    if (!entry || now - entry.windowStart >= windowMs) {
      local = { count: 1, windowStart: now };
      this.store.set(key, local);
      firstInWindow = true;
    } else {
      entry.count += 1;
      local = entry;
    }

    // Mirror to the shared Redis counter and reconcile the local count up to
    // the cross-replica total so enforcement holds across instances. Best
    // effort + fire-and-forget to keep this method synchronous; Redis TTL
    // matches the window so it self-expires.
    if (this.counter?.usingRedis) {
      const redisKey = `${this.prefix}${key}`;
      void this.counter
        .increment(redisKey, windowMs, local.windowStart)
        .then((shared) => {
          const cur = this.store.get(key);
          // Only reconcile if still the same window and Redis is ahead.
          if (cur && cur.windowStart === local.windowStart && shared > cur.count) {
            cur.count = shared;
          }
        })
        .catch((err) => {
          this.logger.debug(`Rate-limit Redis mirror failed: ${(err as Error).message}`);
        });
    }

    const resetAt = local.windowStart + windowMs;
    return {
      count: local.count,
      resetAt,
      resetInMs: firstInWindow ? windowMs : Math.max(0, resetAt - now),
    };
  }

  /** Drop stale in-memory fallback entries. Retained for tests/diagnostics. */
  cleanup(maxAgeMs = 5 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.windowStart < cutoff) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Rate limit store: removed ${removed} stale entries`);
    }
    return removed;
  }

  get size(): number {
    return this.store.size;
  }

  /**
   * Retained for backward compatibility (callers/tests previously stopped the
   * sweep interval here). There is no interval anymore — Redis TTL handles
   * expiry — so this just clears the in-memory fallback map.
   */
  onModuleDestroy(): void {
    this.store.clear();
  }
}
