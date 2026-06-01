import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { TenantsService } from './tenants.service';

/**
 * Multi-business memberships (Phase 5 / W1a): create-business, list, and the
 * membership-checked active-tenant switch.
 */
describe('TenantsService', () => {
  afterEach(() => jest.clearAllMocks());

  function build() {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => ({ activeTenantId: 't1', tenantId: 't1' })),
        update: jest.fn(async () => ({})),
      },
      membership: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: 'm1' })),
      },
      tenant: {
        findUnique: jest.fn(async () => null), // slug free
        create: jest.fn(async ({ data }: any) => ({
          id: 'new-tenant',
          name: data.name,
          plan: data.plan,
        })),
      },
    };
    const authService = {
      issueTokensForUser: jest.fn(async () => ({
        accessToken: 'new.jwt',
        refreshToken: 'r',
        expiresIn: 900,
        user: { id: 'u1', email: 'o@x.com', name: 'O', role: 'OWNER' },
      })),
    };
    const service = new TenantsService(prisma as any, authService as any);
    return { service, prisma, authService };
  }

  it('lists the user businesses with the active one flagged', async () => {
    const { service, prisma } = build();
    prisma.user.findUnique.mockResolvedValueOnce({ activeTenantId: 't2', tenantId: 't1' } as any);
    prisma.membership.findMany.mockResolvedValueOnce([
      { tenantId: 't1', role: 'OWNER', status: 'SUSPENDED', tenant: { id: 't1', name: 'Biz One', plan: 'GROWTH' } },
      { tenantId: 't2', role: 'OPERATOR', status: 'ACTIVE', tenant: { id: 't2', name: 'Biz Two', plan: 'STARTER' } },
    ] as any);

    const list = await service.listForUser('u1');
    // Still lists a suspended business, but surfaces status so the UI can flag it.
    expect(list).toEqual([
      { tenantId: 't1', name: 'Biz One', plan: 'GROWTH', role: 'OWNER', status: 'SUSPENDED', isActive: false },
      { tenantId: 't2', name: 'Biz Two', plan: 'STARTER', role: 'OPERATOR', status: 'ACTIVE', isActive: true },
    ]);
  });

  it('creates a new business + OWNER membership (TRIALING trial defaults)', async () => {
    const { service, prisma } = build();
    const result = await service.createForUser('u1', 'Side Hustle');

    expect(prisma.tenant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Side Hustle',
          status: 'ACTIVE',
          subscriptionStatus: 'TRIALING',
          plan: 'GROWTH',
        }),
      }),
    );
    // The OWNER Membership is now inserted SEPARATELY (in the new tenant's RLS
    // context), not as a nested write under tenant.create — so the WITH CHECK
    // (tenantId = app.tenant_id) on the RLS-forced memberships table passes.
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: { userId: 'u1', tenantId: 'new-tenant', role: 'OWNER' },
    });
    expect(result).toEqual(
      expect.objectContaining({ tenantId: 'new-tenant', role: 'OWNER', name: 'Side Hustle' }),
    );
  });

  // -- FU-06: concurrent-trial cap (no unlimited free perpetual trials) -------

  describe('trial cap (FU-06)', () => {
    const ORIGINAL = process.env.MAX_CONCURRENT_TRIALS;
    afterEach(() => {
      if (ORIGINAL === undefined) delete process.env.MAX_CONCURRENT_TRIALS;
      else process.env.MAX_CONCURRENT_TRIALS = ORIGINAL;
    });

    it('rejects a 2nd trialing business when already at the cap (default 1) with 402', async () => {
      delete process.env.MAX_CONCURRENT_TRIALS; // default 1
      const { service, prisma } = build();
      prisma.membership.findMany.mockResolvedValue([
        { tenantId: 't1', tenant: { subscriptionStatus: 'TRIALING' } },
      ] as any);

      const err = await service.createForUser('u1', 'Second Biz').catch((e) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it('ALLOWS another business when the user already has a paid (ACTIVE) subscription', async () => {
      delete process.env.MAX_CONCURRENT_TRIALS; // default 1
      const { service, prisma } = build();
      prisma.membership.findMany.mockResolvedValue([
        { tenantId: 't1', tenant: { subscriptionStatus: 'TRIALING' } },
        { tenantId: 't2', tenant: { subscriptionStatus: 'ACTIVE' } },
      ] as any);

      const result = await service.createForUser('u1', 'Third Biz');
      expect(prisma.tenant.create).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ tenantId: 'new-tenant', role: 'OWNER' }),
      );
    });

    it('honours a higher MAX_CONCURRENT_TRIALS cap', async () => {
      process.env.MAX_CONCURRENT_TRIALS = '2';
      const { service, prisma } = build();
      prisma.membership.findMany.mockResolvedValue([
        { tenantId: 't1', tenant: { subscriptionStatus: 'TRIALING' } },
      ] as any);

      // 1 trialing < cap 2 → allowed
      await expect(service.createForUser('u1', 'Biz Two')).resolves.toEqual(
        expect.objectContaining({ tenantId: 'new-tenant' }),
      );
    });
  });

  it('switches to a tenant the user is a member of and re-issues a token', async () => {
    const { service, prisma, authService } = build();
    prisma.membership.findUnique.mockResolvedValueOnce({
      userId: 'u1',
      tenantId: 't2',
      role: 'OPERATOR',
    } as any);

    const tokens = await service.switchForUser(
      { id: 'u1', email: 'o@x.com', name: 'O', role: 'OWNER' },
      't2',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { activeTenantId: 't2' },
    });
    expect(authService.issueTokensForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', role: 'OPERATOR', activeTenantId: 't2' }),
    );
    expect(tokens.accessToken).toBe('new.jwt');
  });

  it('rejects a switch to a tenant where the membership is SUSPENDED (403)', async () => {
    const { service, prisma, authService } = build();
    prisma.membership.findUnique.mockResolvedValueOnce({
      userId: 'u1',
      tenantId: 't2',
      role: 'OPERATOR',
      status: 'SUSPENDED',
    } as any);

    await expect(
      service.switchForUser({ id: 'u1', email: 'o@x.com', name: 'O', role: 'OWNER' }, 't2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(authService.issueTokensForUser).not.toHaveBeenCalled();
  });

  it('rejects a switch to a tenant the user is NOT a member of (403)', async () => {
    const { service, prisma, authService } = build();
    prisma.membership.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.switchForUser({ id: 'u1', email: 'o@x.com', name: 'O', role: 'OWNER' }, 'other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(authService.issueTokensForUser).not.toHaveBeenCalled();
  });
});
