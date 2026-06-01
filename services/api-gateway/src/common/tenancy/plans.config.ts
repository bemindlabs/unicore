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

import type { ProFeature } from '../../license/interfaces/license.interface';

export type PlanKey = 'STARTER' | 'GROWTH';

/** License edition each plan maps to (reuse of the existing license system). */
export type LicenseEditionForPlan = 'community' | 'pro';

/**
 * Per-edition feature flags (reuse of the license feature-flag chain). STARTER
 * maps to the community flag set, GROWTH (and an in-trial tenant) to the full
 * pro set. This is the SINGLE per-tenant plan → feature-flags map the
 * LicenseGuard consults so gating is driven by `tenant.plan`, NOT the
 * process-global UNICORE_EDITION.
 */
export const EDITION_FEATURE_FLAGS: Record<LicenseEditionForPlan, ProFeature[]> = {
  community: ['auditLogs'],
  pro: [
    'allAgents',
    'customAgentBuilder',
    'fullRbac',
    'advancedWorkflows',
    'allChannels',
    'unlimitedRag',
    'whiteLabelBranding',
    'sso',
    'auditLogs',
    'prioritySupport',
    'multiTenancy',
  ],
};

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
  /**
   * Noisy-neighbor protection (FU-04), saas mode only. These are PLACEHOLDER
   * caps behind env so real limits drop in at launch without code changes:
   *
   *  - `rateLimitPerMinute`: short-window burst ceiling enforced per tenant at
   *    the gateway. STARTER lower, GROWTH higher.
   *  - `monthlyApiCallCap`: hard monthly usage cap (the `apiCallsThisMonth`
   *    quota surfaced in the admin tenant DTO). Exceeding it returns HTTP 429.
   */
  rateLimitPerMinute: number;
  monthlyApiCallCap: number;
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
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_STARTER_PER_MIN || '120', 10),
    monthlyApiCallCap: parseInt(process.env.API_CAP_STARTER_MONTHLY || '50000', 10),
  },
  GROWTH: {
    key: 'GROWTH',
    name: 'UniCore Growth',
    priceId: process.env.STRIPE_PRICE_GROWTH || 'price_growth_placeholder',
    amount: parseInt(process.env.STRIPE_AMOUNT_GROWTH || '0', 10),
    edition: 'pro',
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_GROWTH_PER_MIN || '600', 10),
    monthlyApiCallCap: parseInt(process.env.API_CAP_GROWTH_MONTHLY || '500000', 10),
  },
};

/**
 * Per-minute burst limit for the given plan key. Reads env LIVE (not the cached
 * PLANS object) so caps can be tuned via env without a rebuild, and so tests
 * can override per-case.
 */
export function rateLimitForPlan(key: string | null | undefined): number {
  const plan = getPlan(key);
  const env =
    plan.key === 'GROWTH'
      ? process.env.RATE_LIMIT_GROWTH_PER_MIN
      : process.env.RATE_LIMIT_STARTER_PER_MIN;
  const parsed = parseInt(env ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : plan.rateLimitPerMinute;
}

/** Monthly API-call cap for the given plan key. Reads env LIVE (see above). */
export function monthlyApiCapForPlan(key: string | null | undefined): number {
  const plan = getPlan(key);
  const env =
    plan.key === 'GROWTH'
      ? process.env.API_CAP_GROWTH_MONTHLY
      : process.env.API_CAP_STARTER_MONTHLY;
  const parsed = parseInt(env ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : plan.monthlyApiCallCap;
}

/** Look up a plan by key; defaults to STARTER for unknown values. */
export function getPlan(key: string | null | undefined): PlanDefinition {
  const normalized = (key || '').toUpperCase();
  if (normalized === 'GROWTH') return PLANS.GROWTH;
  return PLANS.STARTER;
}

/**
 * Resolve the effective feature flags for a tenant from its OWN plan and trial
 * state — the per-tenant entitlement source the LicenseGuard checks.
 *
 *  - A TRIALING tenant gets the FULL Growth (pro) feature set for the whole
 *    trial (fixed product decision — full Growth during the 30-day trial).
 *  - Otherwise the flags come from the plan's license edition (STARTER →
 *    community flags, GROWTH → pro flags).
 *
 * This deliberately ignores the process-global UNICORE_EDITION so one tenant on
 * STARTER can be denied a Growth-only feature while a GROWTH/trial tenant on the
 * same process is allowed.
 */
export function featureFlagsForTenant(tenant: {
  plan?: string | null;
  subscriptionStatus?: string | null;
}): ProFeature[] {
  const isTrialing = (tenant.subscriptionStatus || '').toUpperCase() === 'TRIALING';
  const edition: LicenseEditionForPlan = isTrialing
    ? PLANS[TRIAL_PLAN].edition
    : getPlan(tenant.plan).edition;
  return EDITION_FEATURE_FLAGS[edition];
}

/**
 * Max concurrent TRIALING businesses a single user may own (FU-06 anti-abuse).
 * Default 1; configurable via MAX_CONCURRENT_TRIALS. Read live so it can be
 * tuned via env without a rebuild and overridden per test.
 */
export function maxConcurrentTrials(): number {
  const parsed = parseInt(process.env.MAX_CONCURRENT_TRIALS ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
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
