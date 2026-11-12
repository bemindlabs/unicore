import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLANS,
  TRIAL_PLAN,
  getPlan,
  trialDaysRemaining,
} from '../common/tenancy/plans.config';
import { TrialReminderMilestone } from '../email/templates/trial-emails';

/** Reminder milestones, in days-before-expiry. T-0 = expiry day. */
export const REMINDER_DAYS: TrialReminderMilestone[] = [7, 3, 1, 0];

export interface SubscriptionView {
  tenantId: string;
  plan: string;
  /** TRIALING | ACTIVE | PAST_DUE | CANCELED */
  subscriptionStatus: string;
  /** ACTIVE | SUSPENDED | PENDING | ARCHIVED */
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  isTrialing: boolean;
  /** True once expiry has flipped the tenant to read-only. */
  suspended: boolean;
  /**
   * License edition the current entitlements map to. During the trial this is
   * the full Growth edition; reuse of the existing license feature-flag chain.
   */
  entitlementEdition: 'community' | 'pro';
}

/**
 * Tenant subscription / trial state (M3/E3).
 *
 * Owns the dashboard subscription view, the reminder-selection logic, and the
 * trial-expiry → SUSPENDED transition. Entitlements during a trial map to the
 * full Growth feature set (reuse of the license edition/flags — not a parallel
 * entitlement system).
 */
@Injectable()
export class TenantSubscriptionService {
  private readonly logger = new Logger(TenantSubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Build the dashboard subscription/trial view for a tenant. */
  async getSubscription(tenantId: string, now: Date = new Date()): Promise<SubscriptionView> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const isTrialing = tenant.subscriptionStatus === 'TRIALING';
    const suspended = tenant.status === 'SUSPENDED';

    // Trial entitlements = full Growth; a converted ACTIVE tenant uses its plan.
    const entitlementEdition = isTrialing
      ? PLANS[TRIAL_PLAN].edition
      : getPlan(tenant.plan).edition;

    return {
      tenantId: tenant.id,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscriptionStatus,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt ? tenant.trialEndsAt.toISOString() : null,
      trialDaysRemaining: isTrialing ? trialDaysRemaining(tenant.trialEndsAt, now) : 0,
      isTrialing,
      suspended,
      entitlementEdition,
    };
  }

  /**
   * Apply a Stripe-driven subscription state change to a tenant (M3/E4).
   *
   * Called by the platform Stripe webhook (flowType="saas") via the internal
   * endpoint. On a successful subscription it sets subscriptionStatus=ACTIVE,
   * records the Stripe ids, sets the plan, and clears any trial-suspend
   * (status back to ACTIVE). past_due/canceled map to the matching state;
   * canceled becomes SUSPENDED (read-only). Idempotent.
   */
  async applySubscriptionUpdate(input: {
    tenantId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
    plan?: string;
  }): Promise<SubscriptionView> {
    const { subscriptionStatus } = input;

    // Resolve the tenant by id, then by stripe subscription/customer id.
    let tenant = input.tenantId
      ? await this.prisma.tenant.findUnique({ where: { id: input.tenantId } })
      : null;
    if (!tenant && input.stripeSubscriptionId) {
      tenant = await this.prisma.tenant.findUnique({
        where: { stripeSubscriptionId: input.stripeSubscriptionId },
      });
    }
    if (!tenant && input.stripeCustomerId) {
      tenant = await this.prisma.tenant.findFirst({
        where: { stripeCustomerId: input.stripeCustomerId },
      });
    }
    if (!tenant) {
      throw new NotFoundException('Tenant not found for subscription update');
    }

    // Status: ACTIVE clears the trial-suspend; CANCELED → SUSPENDED (read-only);
    // PAST_DUE keeps access (grace) until Stripe ultimately cancels.
    const tenantStatus =
      subscriptionStatus === 'ACTIVE'
        ? 'ACTIVE'
        : subscriptionStatus === 'CANCELED'
          ? 'SUSPENDED'
          : tenant.status;

    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus,
        status: tenantStatus,
        ...(input.plan ? { plan: getPlan(input.plan).key } : {}),
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        ...(input.stripeSubscriptionId
          ? { stripeSubscriptionId: input.stripeSubscriptionId }
          : {}),
      },
    });

    this.logger.log(
      `Subscription update applied: tenant ${updated.id} -> ${subscriptionStatus} (status ${tenantStatus}, plan ${updated.plan})`,
    );
    return this.getSubscription(updated.id);
  }

  /**
   * Which reminder milestone (if any) a trialing tenant is due for on `now`.
   * Returns the largest matching milestone (so a tenant 7 days out gets T-7),
   * or null when none applies. Pure/deterministic — unit-testable.
   */
  reminderMilestoneFor(trialEndsAt: Date | null, now: Date = new Date()): TrialReminderMilestone | null {
    if (!trialEndsAt) return null;
    const remaining = trialDaysRemaining(trialEndsAt, now);
    // T-0: expiry day or past (still trialing) → final reminder.
    if (trialEndsAt.getTime() <= now.getTime()) return 0;
    if (REMINDER_DAYS.includes(remaining as TrialReminderMilestone)) {
      return remaining as TrialReminderMilestone;
    }
    return null;
  }
}
