import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { TenantSubscriptionController } from './tenant-subscription.controller';
import { TenantInternalController } from './tenant-internal.controller';
import { TrialSchedulerService } from './trial-scheduler.service';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';

/**
 * Tenant subscription / trial lifecycle (M3/E3+E4).
 *
 *  - TenantSubscriptionController : dashboard trial/subscription status.
 *  - TenantInternalController     : internal endpoint the Stripe webhook calls.
 *  - TrialSchedulerService        : daily saas-only reminder + expiry→suspend sweep.
 */
@Module({
  imports: [PrismaModule, EmailModule, AuthModule],
  controllers: [TenantSubscriptionController, TenantInternalController, TenantsController],
  providers: [TenantSubscriptionService, TrialSchedulerService, TenantsService],
  exports: [TenantSubscriptionService, TenantsService],
})
export class TenantModule {}
