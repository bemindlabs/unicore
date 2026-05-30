import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { TenantSubscriptionController } from './tenant-subscription.controller';
import { TenantInternalController } from './tenant-internal.controller';
import { TrialSchedulerService } from './trial-scheduler.service';

/**
 * Tenant subscription / trial lifecycle (M3/E3+E4).
 *
 *  - TenantSubscriptionController : dashboard trial/subscription status.
 *  - TenantInternalController     : internal endpoint the Stripe webhook calls.
 *  - TrialSchedulerService        : daily saas-only reminder + expiry→suspend sweep.
 */
@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TenantSubscriptionController, TenantInternalController],
  providers: [TenantSubscriptionService, TrialSchedulerService],
  exports: [TenantSubscriptionService],
})
export class TenantModule {}
