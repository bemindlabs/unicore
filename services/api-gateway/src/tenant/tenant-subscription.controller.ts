import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantSubscriptionService, SubscriptionView } from './tenant-subscription.service';

/**
 * Tenant subscription / trial status (M3/E3). The dashboard reads this for the
 * days-remaining countdown and the upgrade banner.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/v1/tenant')
export class TenantSubscriptionController {
  constructor(private readonly subscriptions: TenantSubscriptionService) {}

  @Get('subscription')
  getSubscription(@CurrentUser('tenantId') tenantId: string): Promise<SubscriptionView> {
    return this.subscriptions.getSubscription(tenantId);
  }
}
