import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MinimalRedisClient } from '../../domains/redis-client';

/**
 * Shared, Redis-backed fixed-window counter / flag primitive with an in-memory
 * fallback (debt #6). Mirrors the connect-or-degrade pattern of
 * {@link TenantUsageService} / {@link TokenBlacklistService}: Redis is the
 * cross-replica source of truth, but a Redis outage never hard-fails — the
 * counter silently degrades to a process-local map.
 *
 * Used by the auth login-lockout / forgot-password rate limits and the
 * gateway rate-limit store so that brute-force lockout, anti-enumeration, and
 * rate limits hold ACROSS replicas and survive a deploy (no longer reset with
 * the process). Keys carry a TTL so Redis self-expires them (no manual sweep).
 */
@Injectable()
export class RedisCounterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCounterService.name);
  private client: MinimalRedisClient | null = null;
  private connected = false;

  /** In-memory fallback: key → { count, expiresAt(ms) }. */
  private readonly memory = new Map<string, { count: number; expiresAt: number }>();

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new MinimalRedisClient(redisUrl);
    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected for shared counters (auth + rate-limit)');
    } catch (err) {
      this.connected = false;
      this.logger.warn(
        `Could not connect to Redis; counters fall back to in-memory: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit().catch(() => undefined);
    }
  }

  /** Whether Redis is currently the backing store (false → in-memory fallback). */
  get usingRedis(): boolean {
    return this.connected && this.client !== null;
  }

  /** Prune expired in-memory entries (cheap; only touches the fallback map). */
  private pruneMemory(now: number): void {
    if (this.memory.size === 0) return;
    for (const [key, rec] of this.memory) {
      if (rec.expiresAt <= now) this.memory.delete(key);
    }
  }

  /**
   * Increment a fixed-window counter and return the new count. On the first
   * increment of a window the key is given a TTL of `windowMs`; Redis then
   * self-expires it (no manual sweep). Falls back to an in-memory window when
   * Redis is down.
   */
  async increment(key: string, windowMs: number, now: number = Date.now()): Promise<number> {
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    if (this.usingRedis && this.client) {
      try {
        const count = await this.client.incr(key);
        if (count === 1) {
          await this.client.expire(key, ttlSeconds);
        }
        return count;
      } catch (err) {
        this.logger.warn(`Redis incr failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }

    this.pruneMemory(now);
    const rec = this.memory.get(key);
    if (!rec || rec.expiresAt <= now) {
      this.memory.set(key, { count: 1, expiresAt: now + windowMs });
      return 1;
    }
    rec.count += 1;
    return rec.count;
  }

  /** Read the current counter value without incrementing. */
  async get(key: string, now: number = Date.now()): Promise<number> {
    if (this.usingRedis && this.client) {
      try {
        const raw = await this.client.get(key);
        return raw ? parseInt(raw, 10) : 0;
      } catch (err) {
        this.logger.warn(`Redis get failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }
    this.pruneMemory(now);
    const rec = this.memory.get(key);
    return rec && rec.expiresAt > now ? rec.count : 0;
  }

  /** Set a boolean flag with a TTL (used for the login lockout marker). */
  async setFlag(key: string, ttlMs: number, now: number = Date.now()): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    if (this.usingRedis && this.client) {
      try {
        await this.client.set(key, '1', { EX: ttlSeconds });
        return;
      } catch (err) {
        this.logger.warn(`Redis set failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }
    this.memory.set(key, { count: 1, expiresAt: now + ttlMs });
  }

  /** Whether a flag/key currently exists (and has not expired). */
  async hasFlag(key: string, now: number = Date.now()): Promise<boolean> {
    if (this.usingRedis && this.client) {
      try {
        return (await this.client.exists(key)) === 1;
      } catch (err) {
        this.logger.warn(`Redis exists failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }
    this.pruneMemory(now);
    const rec = this.memory.get(key);
    return !!rec && rec.expiresAt > now;
  }

  /** Delete one or more keys (e.g. clear lockout + fail counter on success). */
  async del(...keys: string[]): Promise<void> {
    if (this.usingRedis && this.client) {
      try {
        for (const key of keys) await this.client.del(key);
        return;
      } catch (err) {
        this.logger.warn(`Redis del failed, using in-memory: ${(err as Error).message}`);
        this.connected = false;
      }
    }
    for (const key of keys) this.memory.delete(key);
  }
}
