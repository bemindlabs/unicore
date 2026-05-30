/**
 * SaaS plan catalog — the SINGLE pricing config point (M3/E3+E4).
 *
 * Pricing numbers are a DEFERRED business decision. Real Stripe price IDs and
 * amounts drop in here later via the `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH`
 * env vars without touching any other code. Every part of the gateway that needs
 * a plan → price-id, plan → license-edition, or plan → trial-entitlement mapping
 * reads from this one module.
 *
 * Product decisions (fixed):
 *  - 30-day free trial, NO card up front.
 *  - During the trial the tenant gets the FULL Growth feature set.
 *  - STARTER maps to community license flags, GROWTH maps to pro license flags.
 */

export type PlanKey = 'STARTER' | 'GROWTH';

/** License edition each plan maps to (reuse of the existing license system). */
export type LicenseEditionForPlan = 'community' | 'pro';

export interface PlanDefinition {
  /** Tenant.plan value. */
  key: PlanKey;
  /** Human label for dashboards / Stripe line items. */
  name: string;
  /** Placeholder Stripe price id, overridable via env. Real value set later. */
  priceId: string;
  /**
   * Placeholder monthly amount in minor units (e.g. cents). Pricing deferred —
   * 0 means "not yet set". Stored only so the structure is ready.
   */
  amount: number;
  /** License edition this plan grants (Stripe plan → license edition chain). */
  edition: LicenseEditionForPlan;
}

/** Length of the free trial in days (fixed product decision). */
export const TRIAL_DAYS = 30;

/**
 * During the trial, entitlements equal the full Growth feature set. This is the
 * plan whose license flags the trial maps to (reuse of the license feature-flags
 * — NOT a parallel entitlement system).
 */
export const TRIAL_PLAN: PlanKey = 'GROWTH';

/**
 * The plan catalog. Price ids and amounts come from env so real values can be
 * dropped in at launch without code changes; placeholders keep dev/test working.
 */
export const PLANS: Record<PlanKey, PlanDefinition> = {
  STARTER: {
    key: 'STARTER',
    name: 'UniCore Starter',
    priceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_placeholder',
    amount: parseInt(process.env.STRIPE_AMOUNT_STARTER || '0', 10),
    edition: 'community',
  },
  GROWTH: {
    key: 'GROWTH',
    name: 'UniCore Growth',
    priceId: process.env.STRIPE_PRICE_GROWTH || 'price_growth_placeholder',
    amount: parseInt(process.env.STRIPE_AMOUNT_GROWTH || '0', 10),
    edition: 'pro',
  },
};

/** Look up a plan by key; defaults to STARTER for unknown values. */
export function getPlan(key: string | null | undefined): PlanDefinition {
  const normalized = (key || '').toUpperCase();
  if (normalized === 'GROWTH') return PLANS.GROWTH;
  return PLANS.STARTER;
}

/** Compute the trial end date from a start instant. */
export function computeTrialEnd(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setUTCDate(end.getUTCDate() + TRIAL_DAYS);
  return end;
}

/**
 * Whole days remaining until trial end (clamped at 0). Used for the dashboard
 * countdown / banner.
 */
export function trialDaysRemaining(trialEndsAt: Date | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
