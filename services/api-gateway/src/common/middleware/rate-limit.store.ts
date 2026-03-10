import { Injectable, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface IncrementResult {
  count: number;
  resetAt: number;
  resetInMs: number;
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class RateLimitStore {
  private readonly logger = new Logger(RateLimitStore.name);
  private readonly store = new Map<string, RateLimitEntry>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  increment(key: string, windowMs: number): IncrementResult {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      const newEntry: RateLimitEntry = { count: 1, windowStart: now };
      this.store.set(key, newEntry);
      const resetAt = now + windowMs;
      return { count: 1, resetAt, resetInMs: windowMs };
    }

    entry.count += 1;
    const resetAt = entry.windowStart + windowMs;
    return { count: entry.count, resetAt, resetInMs: resetAt - now };
  }

  cleanup(maxAgeMs = CLEANUP_INTERVAL_MS): number {
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

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
