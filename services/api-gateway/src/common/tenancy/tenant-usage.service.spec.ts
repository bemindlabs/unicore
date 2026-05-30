import { TenantUsageService } from './tenant-usage.service';

describe('TenantUsageService', () => {
  describe('currentPeriod', () => {
    it('formats the UTC year-month', () => {
      expect(TenantUsageService.currentPeriod(new Date('2026-05-31T23:00:00Z'))).toBe('2026-05');
      expect(TenantUsageService.currentPeriod(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
    });
  });

  describe('secondsUntilMonthEnd', () => {
    it('returns the seconds to the start of next month (UTC)', () => {
      const now = new Date('2026-05-31T00:00:00Z');
      // 1 full day to 2026-06-01T00:00:00Z.
      expect(TenantUsageService.secondsUntilMonthEnd(now)).toBe(24 * 60 * 60);
    });

    it('never returns less than 60s', () => {
      const now = new Date('2026-05-31T23:59:59Z');
      expect(TenantUsageService.secondsUntilMonthEnd(now)).toBeGreaterThanOrEqual(60);
    });
  });

  describe('in-memory fallback (no Redis)', () => {
    it('increments per tenant+period independently', async () => {
      const svc = new TenantUsageService(); // never connected → memory path
      const now = new Date('2026-05-15T00:00:00Z');
      expect(await svc.increment('a', now)).toBe(1);
      expect(await svc.increment('a', now)).toBe(2);
      expect(await svc.increment('b', now)).toBe(1);
      expect(await svc.current('a', now)).toBe(2);
    });

    it('resets across month boundaries', async () => {
      const svc = new TenantUsageService();
      await svc.increment('a', new Date('2026-05-15T00:00:00Z'));
      expect(await svc.current('a', new Date('2026-06-01T00:00:00Z'))).toBe(0);
    });
  });
});
