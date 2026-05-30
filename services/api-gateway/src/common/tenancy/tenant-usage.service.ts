import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MinimalRedisClient } from '../../domains/redis-client';

/**
 * Per-tenant monthly usage counter (FU-04, noisy-neighbor protection).
 *
 * Increments a Redis counter keyed by `usage:{tenantId}:{YYYY-MM}` on each
 * billable API/AI call so the gateway can enforce a tenant's monthly plan cap
 * (the `apiCallsThisMonth` quota in the admin tenant DTO). The key is given a
 * TTL just past the end of the month so counters self-expire.
 *
 * Redis is the source of truth in saas; when Redis is unavailable the service
 * degrades to an in-memory map (mirrors DomainCacheService) so a Redis outage
 * never hard-fails the API — it just loses cross-instance accuracy.
 *
 * Self-host never calls this (the guard short-circuits before it runs).
 */
@Injectable()
export class TenantUsageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantUsageService.name);
  private client: MinimalRedisClient | null = null;
  private connected = false;
  private readonly memory = new Map<string, number>();

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new MinimalRedisClient(redisUrl);
    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected for per-tenant usage counters');
    } catch (err) {
      this.connected = false;
      this.logger.warn(
        `Could not connect to Redis; usage counters fall back to in-memory: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit().catch(() => undefined);
    }
  }

  /** Current `YYYY-MM` period (UTC). */
  static currentPeriod(now: Date = new Date()): string {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /** Seconds remaining until the end of the current UTC month (for the TTL). */
  static secondsUntilMonthEnd(now: Date = new Date()): number {
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0);
    return Math.max(60, Math.ceil((end - now.getTime()) / 1000));
  }

  private key(tenantId: string, period: string): string {
    return `usage:${tenantId}:${period}`;
  }

  /**
   * Increment the tenant's counter for the current month and return the new
   * total. Used by the guard to compare against the plan cap.
   */
  async increment(tenantId: string, now: Date = new Date()): Promise<number> {
    const period = TenantUsageService.currentPeriod(now);
    const key = this.key(tenantId, period);

    if (this.connected && this.client) {
      try {
        const count = await this.client.incr(key);
        if (count === 1) {
          await this.client.expire(key, TenantUsageService.secondsUntilMonthEnd(now));
        }
        return count;
      } catch (err) {
        this.logger.warn(`Redis incr failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }

    const next = (this.memory.get(key) ?? 0) + 1;
    this.memory.set(key, next);
    return next;
  }

  /** Read the current count without incrementing (admin/reporting). */
  async current(tenantId: string, now: Date = new Date()): Promise<number> {
    const key = this.key(tenantId, TenantUsageService.currentPeriod(now));
    if (this.connected && this.client) {
      try {
        const raw = await this.client.get(key);
        return raw ? parseInt(raw, 10) : 0;
      } catch {
        /* fall through to memory */
      }
    }
    return this.memory.get(key) ?? 0;
  }
}
