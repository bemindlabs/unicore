import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { LicenseGuard } from './license.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PRO_FEATURE_KEY } from '../decorators/pro-feature.decorator';
import { DEMO_TENANT_ID } from '../../common/tenancy/tenancy.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockExecutionContext(
  request: Record<string, unknown> = {},
): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests — GAPS #3: gating is PER-TENANT (tenant.plan + trial), not global.
// ---------------------------------------------------------------------------

describe('LicenseGuard (per-tenant plan gating)', () => {
  let guard: LicenseGuard;
  let reflector: Reflector;
  let prisma: { tenant: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { tenant: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseGuard,
        Reflector,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get<LicenseGuard>(LicenseGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => jest.restoreAllMocks());

  it('allows request when no ProFeatureRequired metadata is set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = await guard.canActivate(mockExecutionContext());

    expect(result).toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('DENIES a Growth-only feature to a STARTER tenant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    prisma.tenant.findUnique.mockResolvedValue({
      plan: 'STARTER',
      subscriptionStatus: 'ACTIVE',
    });
    const ctx = mockExecutionContext({ user: { tenantId: 't-starter' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Growth/);
  });

  it('ALLOWS a Growth-only feature to a GROWTH tenant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    prisma.tenant.findUnique.mockResolvedValue({
      plan: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
    });
    const ctx = mockExecutionContext({ user: { tenantId: 't-growth' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('ALLOWS a Growth-only feature to a TRIALING STARTER tenant (full Growth during trial)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('sso');
    prisma.tenant.findUnique.mockResolvedValue({
      plan: 'STARTER',
      subscriptionStatus: 'TRIALING',
    });
    const ctx = mockExecutionContext({ user: { tenantId: 't-trial' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows a community-tier feature (auditLogs) to a STARTER tenant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('auditLogs');
    prisma.tenant.findUnique.mockResolvedValue({
      plan: 'STARTER',
      subscriptionStatus: 'ACTIVE',
    });
    const ctx = mockExecutionContext({ user: { tenantId: 't-starter' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('does NOT gate on the process-global edition — two tenants on one process differ', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('whiteLabelBranding');

    prisma.tenant.findUnique.mockResolvedValueOnce({
      plan: 'STARTER',
      subscriptionStatus: 'ACTIVE',
    });
    await expect(
      guard.canActivate(mockExecutionContext({ user: { tenantId: 'a' } })),
    ).rejects.toThrow(ForbiddenException);

    prisma.tenant.findUnique.mockResolvedValueOnce({
      plan: 'GROWTH',
      subscriptionStatus: 'ACTIVE',
    });
    await expect(
      guard.canActivate(mockExecutionContext({ user: { tenantId: 'b' } })),
    ).resolves.toBe(true);
  });

  it('exempts super-admins (Bemind ops) without a DB lookup', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    const ctx = mockExecutionContext({ user: { isSuperAdmin: true } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('exempts internal service-to-service calls', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    const ctx = mockExecutionContext({ headers: { 'x-internal-service': 'erp' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('exempts the local/demo bootstrap tenant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    const ctx = mockExecutionContext({ user: { tenantId: DEMO_TENANT_ID } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('denies a feature-gated route with no resolvable tenant', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    const ctx = mockExecutionContext({ user: {} });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('checks the correct PRO_FEATURE_KEY metadata key', async () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);

    await guard.canActivate(mockExecutionContext());

    expect(spy).toHaveBeenCalledWith(PRO_FEATURE_KEY, expect.any(Array));
  });
});
