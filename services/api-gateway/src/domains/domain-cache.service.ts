import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MinimalRedisClient } from './redis-client';
import type { DomainCacheEntry, DomainRoutingConfig } from './types/domain.types';

const DEFAULT_CONFIG: DomainRoutingConfig = {
  platformDomains: (process.env.PLATFORM_DOMAINS ?? 'localhost,unicore.io')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean),
  cacheTtlSeconds: parseInt(process.env.DOMAIN_CACHE_TTL_SECONDS ?? '300', 10),
  cacheKeyPrefix: process.env.DOMAIN_CACHE_KEY_PREFIX ?? 'domain:',
};

@Injectable()
export class DomainCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DomainCacheService.name);
  private readonly config: DomainRoutingConfig = DEFAULT_CONFIG;
  private client: MinimalRedisClient | null = null;
  private connected = false;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new MinimalRedisClient(redisUrl);

    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected for domain cache');
    } catch (err) {
      this.logger.warn(
        `Could not connect to Redis; domain cache will be disabled: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit().catch(() => undefined);
    }
  }

  /**
   * Return a cached entry for the given hostname, or null on miss / Redis down.
   */
  async get(hostname: string): Promise<DomainCacheEntry | null> {
    if (!this.connected || !this.client) return null;

    const key = this.buildKey(hostname);
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as DomainCacheEntry;
    } catch (err) {
      this.logger.warn(`Cache GET failed for ${hostname}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Store a domain→tenant mapping in Redis with the configured TTL.
   */
  async set(hostname: string, entry: DomainCacheEntry): Promise<void> {
    if (!this.connected || !this.client) return;

    const key = this.buildKey(hostname);
    try {
      await this.client.set(key, JSON.stringify(entry), {
        EX: this.config.cacheTtlSeconds,
      });
    } catch (err) {
      this.logger.warn(`Cache SET failed for ${hostname}: ${(err as Error).message}`);
    }
  }

  /**
   * Invalidate a cached domain entry — call this when a domain record changes.
   */
  async invalidate(hostname: string): Promise<void> {
    if (!this.connected || !this.client) return;

    const key = this.buildKey(hostname);
    try {
      await this.client.del(key);
      this.logger.debug(`Invalidated domain cache for ${hostname}`);
    } catch (err) {
      this.logger.warn(
        `Cache invalidation failed for ${hostname}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Invalidate all domain cache entries for a given tenant.
   * Iterates over matching keys via the internal scanIterator.
   */
  async invalidateByTenant(tenantId: string): Promise<number> {
    if (!this.connected || !this.client) return 0;

    const pattern = `${this.config.cacheKeyPrefix}*`;
    let invalidated = 0;

    try {
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        const raw = await this.client.get(key);
        if (!raw) continue;

        const entry = JSON.parse(raw) as DomainCacheEntry;
        if (entry.tenantId === tenantId) {
          await this.client.del(key);
          invalidated++;
        }
      }

      if (invalidated > 0) {
        this.logger.debug(
          `Invalidated ${invalidated} domain cache entries for tenant ${tenantId}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Tenant cache invalidation failed for ${tenantId}: ${(err as Error).message}`,
      );
    }

    return invalidated;
  }

  get ttlSeconds(): number {
    return this.config.cacheTtlSeconds;
  }

  private buildKey(hostname: string): string {
    return `${this.config.cacheKeyPrefix}${hostname.toLowerCase()}`;
  }
}
