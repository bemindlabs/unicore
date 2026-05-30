import { HttpException, HttpStatus } from '@nestjs/common';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';
import { RateLimitStore } from '../middleware/rate-limit.store';

function ctx(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('TenantRateLimitGuard', () => {
  const original = process.env.DEPLOYMENT_MODE;
  const originalStarterRate = process.env.RATE_LIMIT_STARTER_PER_MIN;
  const originalStarterCap = process.env.API_CAP_STARTER_MONTHLY;

  let store: RateLimitStore;

  afterEach(() => {
    process.env.DEPLOYMENT_MODE = original;
    process.env.RATE_LIMIT_STARTER_PER_MIN = originalStarterRate;
    process.env.API_CAP_STARTER_MONTHLY = originalStarterCap;
    store?.onModuleDestroy();
  });

  function build(opts: { usageCount?: number; plan?: string } = {}) {
    store = new RateLimitStore();
    const usage = {
      increment: jest.fn(async () => opts.usageCount ?? 1),
      current: jest.fn(async () => 0),
    };
    const prisma = {
      tenant: { findUnique: jest.fn(async () => ({ plan: opts.plan ?? 'STARTER' })) },
    };
    const guard = new TenantRateLimitGuard(store, usage as any, prisma as any);
    return { guard, usage, prisma };
  }

  it('is a no-op in self-host mode (single tenant never throttled)', async () => {
    process.env.DEPLOYMENT_MODE = 'self-host';
    const { guard, usage, prisma } = build({ usageCount: 1_000_000 });
    await expect(
      guard.canActivate(ctx({ headers: {}, user: { tenantId: 't1' } })),
    ).resolves.toBe(true);
    expect(usage.increment).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  describe('saas mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'saas';
    });

    it('exempts the default (all-zero) tenant', async () => {
      const { guard, usage } = build();
      await expect(
        guard.canActivate(
          ctx({ headers: {}, user: { tenantId: '00000000-0000-0000-0000-000000000000' } }),
        ),
      ).resolves.toBe(true);
      expect(usage.increment).not.toHaveBeenCalled();
    });

    it('exempts internal service calls', async () => {
      const { guard, usage } = build();
      await expect(
        guard.canActivate(
          ctx({ headers: { 'x-internal-service': 'ai-engine' }, user: { tenantId: 't1' } }),
        ),
      ).resolves.toBe(true);
      expect(usage.increment).not.toHaveBeenCalled();
    });

    it('allows a tenant under both limits', async () => {
      const { guard } = build({ usageCount: 5 });
      await expect(
        guard.canActivate(ctx({ headers: {}, user: { tenantId: 't1' } })),
      ).resolves.toBe(true);
    });

    it('returns 429 with a clear body when the monthly cap is exceeded', async () => {
      process.env.API_CAP_STARTER_MONTHLY = '10';
      const { guard } = build({ usageCount: 11, plan: 'STARTER' });
      const err = (await guard
        .canActivate(ctx({ headers: {}, user: { tenantId: 't1' } }))
        .then(() => null)
        .catch((e) => e)) as HttpException | null;
      expect(err).toBeInstanceOf(HttpException);
      expect(err!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const body = err!.getResponse() as Record<string, unknown>;
      expect(body.statusCode).toBe(429);
      expect(body.scope).toBe('monthly-quota');
      expect(body.limit).toBe(10);
      expect(body.used).toBe(11);
      expect(typeof body.message).toBe('string');
    });

    it('returns 429 when the per-tenant burst rate is exceeded', async () => {
      process.env.RATE_LIMIT_STARTER_PER_MIN = '2';
      const { guard } = build({ usageCount: 1, plan: 'STARTER' });
      const req = ctx({ headers: {}, user: { tenantId: 't1' } });
      await expect(guard.canActivate(req)).resolves.toBe(true);
      await expect(guard.canActivate(req)).resolves.toBe(true);
      // 3rd call in the same window > limit of 2 → 429
      await expect(guard.canActivate(req)).rejects.toBeInstanceOf(HttpException);
    });

    it('uses the higher GROWTH cap for growth-plan tenants', async () => {
      process.env.API_CAP_STARTER_MONTHLY = '10';
      // GROWTH default cap (500000) is far above this usage → allowed.
      const { guard } = build({ usageCount: 100, plan: 'GROWTH' });
      await expect(
        guard.canActivate(ctx({ headers: {}, user: { tenantId: 't1' } })),
      ).resolves.toBe(true);
    });
  });
});
