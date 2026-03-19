import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MinimalRedisClient } from '../domains/redis-client';

const BLACKLIST_PREFIX = 'bl:';

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private client: MinimalRedisClient | null = null;
  private connected = false;

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new MinimalRedisClient(redisUrl);

    try {
      await this.client.connect();
      this.connected = true;
      this.logger.log('Redis connected for token blacklist');
    } catch (err) {
      this.logger.warn(
        `Could not connect to Redis for token blacklist: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit().catch(() => undefined);
    }
  }

  /**
   * Add a token identifier to the blacklist with a TTL matching its remaining validity.
   * @param tokenId - The JWT 'jti' claim or a hash of the token
   * @param ttlSeconds - Time-to-live in seconds (should match token's remaining expiry)
   */
  async blacklist(tokenId: string, ttlSeconds: number): Promise<void> {
    if (!this.connected || !this.client) {
      this.logger.warn('Redis not connected — token blacklist unavailable');
      return;
    }

    try {
      await this.client.set(`${BLACKLIST_PREFIX}${tokenId}`, '1', { EX: ttlSeconds });
    } catch (err) {
      this.logger.error(`Failed to blacklist token: ${(err as Error).message}`);
    }
  }

  /**
   * Check whether a token identifier has been blacklisted.
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    if (!this.connected || !this.client) {
      return false;
    }

    try {
      return (await this.client.exists(`${BLACKLIST_PREFIX}${tokenId}`)) === 1;
    } catch (err) {
      this.logger.error(`Failed to check blacklist: ${(err as Error).message}`);
      return false;
    }
  }
}
