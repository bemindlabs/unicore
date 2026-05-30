import { Global, Module } from '@nestjs/common';
import { TenantUsageService } from './tenant-usage.service';

/**
 * Global provider for the per-tenant monthly usage counter (FU-04). Exported
 * globally so both the {@link TenantRateLimitGuard} (registered in AppModule)
 * and the AdminController (live `apiCallsThisMonth`) share a single counter
 * instance / Redis connection.
 */
@Global()
@Module({
  providers: [TenantUsageService],
  exports: [TenantUsageService],
})
export class TenantUsageModule {}
