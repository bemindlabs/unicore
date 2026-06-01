import { Global, Module } from '@nestjs/common';
import { RedisCounterService } from './redis-counter.service';

/**
 * Global provider for the shared Redis-backed counter (debt #6). Exported
 * globally so the {@link AuthService} (login lockout + forgot-password) and the
 * {@link RateLimitStore} (IP/user/tenant rate limits) share a single counter
 * instance / Redis connection, with a coordinated in-memory fallback.
 */
@Global()
@Module({
  providers: [RedisCounterService],
  exports: [RedisCounterService],
})
export class RedisCounterModule {}
