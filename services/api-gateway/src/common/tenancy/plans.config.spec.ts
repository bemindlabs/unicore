import {
  PLANS,
  TRIAL_DAYS,
  TRIAL_PLAN,
  getPlan,
  computeTrialEnd,
  trialDaysRemaining,
} from './plans.config';

describe('plans.config (M3 pricing single config point)', () => {
  it('maps STARTER→community and GROWTH→pro license editions', () => {
    expect(PLANS.STARTER.edition).toBe('community');
    expect(PLANS.GROWTH.edition).toBe('pro');
  });

  it('trial uses the full Growth plan for 30 days', () => {
    expect(TRIAL_DAYS).toBe(30);
    expect(TRIAL_PLAN).toBe('GROWTH');
    expect(PLANS[TRIAL_PLAN].edition).toBe('pro');
  });

  it('getPlan normalizes and defaults to STARTER for unknown values', () => {
    expect(getPlan('growth').key).toBe('GROWTH');
    expect(getPlan('GROWTH').key).toBe('GROWTH');
    expect(getPlan('STARTER').key).toBe('STARTER');
    expect(getPlan('bogus').key).toBe('STARTER');
    expect(getPlan(null).key).toBe('STARTER');
    expect(getPlan(undefined).key).toBe('STARTER');
  });

  it('computeTrialEnd adds exactly 30 days', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const end = computeTrialEnd(from);
    expect(end.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  describe('trialDaysRemaining', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');

    it('returns 0 for null', () => {
      expect(trialDaysRemaining(null, now)).toBe(0);
    });

    it('counts whole days until expiry', () => {
      expect(trialDaysRemaining(new Date('2026-01-17T00:00:00.000Z'), now)).toBe(7);
      expect(trialDaysRemaining(new Date('2026-01-11T00:00:00.000Z'), now)).toBe(1);
    });

    it('clamps to 0 at and past expiry', () => {
      expect(trialDaysRemaining(new Date('2026-01-10T00:00:00.000Z'), now)).toBe(0);
      expect(trialDaysRemaining(new Date('2026-01-05T00:00:00.000Z'), now)).toBe(0);
    });
  });
});
