import { ForbiddenException } from '@nestjs/common';
import { SuspendedTenantGuard } from './suspended-tenant.guard';
import { DEFAULT_TENANT_ID } from '../tenancy/tenancy.config';

function ctx(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('SuspendedTenantGuard', () => {
  const original = process.env.DEPLOYMENT_MODE;
  afterEach(() => {
    process.env.DEPLOYMENT_MODE = original;
  });

  function guardWith(status: string | null) {
    const prisma = {
      tenant: {
        findUnique: jest.fn(async () => (status ? { status } : null)),
      },
    };
    return { guard: new SuspendedTenantGuard(prisma as any), prisma };
  }

  it('passes through in self-host mode regardless of tenant', async () => {
    process.env.DEPLOYMENT_MODE = 'self-host';
    const { guard, prisma } = guardWith('SUSPENDED');
    await expect(
      guard.canActivate(ctx({ method: 'POST', path: '/api/v1/erp/x', user: { tenantId: 't1' } })),
    ).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  describe('saas mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'saas';
    });

    it('allows GET reads even for suspended tenants', async () => {
      const { guard } = guardWith('SUSPENDED');
      await expect(
        guard.canActivate(ctx({ method: 'GET', path: '/api/v1/erp/x', user: { tenantId: 't1' } })),
      ).resolves.toBe(true);
    });

    it('blocks mutating requests for suspended tenants', async () => {
      const { guard } = guardWith('SUSPENDED');
      await expect(
        guard.canActivate(ctx({ method: 'POST', path: '/api/v1/erp/x', user: { tenantId: 't1' } })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows mutating requests for active tenants', async () => {
      const { guard } = guardWith('ACTIVE');
      await expect(
        guard.canActivate(ctx({ method: 'POST', path: '/api/v1/erp/x', user: { tenantId: 't1' } })),
      ).resolves.toBe(true);
    });

    it('allows billing/auth recovery paths even when suspended', async () => {
      const { guard } = guardWith('SUSPENDED');
      await expect(
        guard.canActivate(ctx({ method: 'POST', path: '/api/v1/billing/portal', user: { tenantId: 't1' } })),
      ).resolves.toBe(true);
    });

    it('ignores the default tenant (nothing to suspend)', async () => {
      const { guard, prisma } = guardWith('SUSPENDED');
      await expect(
        guard.canActivate(ctx({ method: 'POST', path: '/x', user: { tenantId: DEFAULT_TENANT_ID } })),
      ).resolves.toBe(true);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('allows internal service calls', async () => {
      const { guard } = guardWith('SUSPENDED');
      await expect(
        guard.canActivate(
          ctx({ method: 'POST', path: '/x', user: { tenantId: 't1' }, headers: { 'x-internal-service': 'ai-engine' } }),
        ),
      ).resolves.toBe(true);
    });
  });
});
