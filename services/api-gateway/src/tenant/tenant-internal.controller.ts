import {
  Body,
  Controller,
  Headers,
  Param,
  Patch,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TenantSubscriptionService, SubscriptionView } from './tenant-subscription.service';

interface SubscriptionUpdateBody {
  subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  plan?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const VALID_STATUSES = ['ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING'];

/**
 * Internal tenant control-plane endpoint (M3/E4).
 *
 * Called server-to-server by the unicore-platform Stripe webhook
 * (flowType="saas") to mirror Stripe subscription state onto the tenant. NOT
 * exposed to end users: authenticated by a shared bearer secret
 * (GATEWAY_INTERNAL_SECRET), bypassing the JWT guard via @Public(). This is the
 * single internal endpoint the webhook needs — the super-admin control-plane UI
 * is M4/E5.
 */
@Public()
@Controller('api/v1/internal/tenants')
export class TenantInternalController {
  constructor(private readonly subscriptions: TenantSubscriptionService) {}

  @Patch(':id/subscription')
  async updateSubscription(
    @Param('id') id: string,
    @Headers('authorization') auth: string | undefined,
    @Body() body: SubscriptionUpdateBody,
  ): Promise<SubscriptionView> {
    this.assertInternalAuth(auth);

    if (!body?.subscriptionStatus || !VALID_STATUSES.includes(body.subscriptionStatus)) {
      throw new BadRequestException(
        `subscriptionStatus must be one of: ${VALID_STATUSES.join(', ')}`,
      );
    }

    return this.subscriptions.applySubscriptionUpdate({
      tenantId: id,
      subscriptionStatus: body.subscriptionStatus,
      plan: body.plan,
      stripeCustomerId: body.stripeCustomerId,
      stripeSubscriptionId: body.stripeSubscriptionId,
    });
  }

  private assertInternalAuth(auth: string | undefined): void {
    const secret = process.env.GATEWAY_INTERNAL_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Internal endpoint not configured');
    }
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (token !== secret) {
      throw new UnauthorizedException('Invalid internal credentials');
    }
  }
}
