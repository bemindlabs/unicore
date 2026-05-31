import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

/**
 * Tenant-context defense-in-depth (Phase 5 / W1a): the JWT strategy resolves the
 * active tenant from `tid` and verifies the user holds a Membership for it.
 */
describe('JwtStrategy.validate (tenant context)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-strategy-secret-at-least-32-chars-long';
  });

  // The strategy now loads the bare user (no memberships relation — that table is
  // RLS-forced and invisible pre-context), then reads the membership for the
  // RESOLVED tenant under that tenant's context via prisma.membership.findUnique.
  // The mock derives that lookup from the test fixture's `memberships` array.
  function build(user: any) {
    const { memberships = [], ...bareUser } = user;
    const prisma = {
      user: { findUnique: jest.fn(async () => bareUser) },
      membership: {
        findUnique: jest.fn(async ({ where }: any) => {
          const tid = where.userId_tenantId.tenantId;
          const m = memberships.find((x: any) => x.tenantId === tid);
          return m ? { tenantId: m.tenantId, role: m.role, status: m.status ?? 'ACTIVE' } : null;
        }),
      },
    };
    const blacklist = { isBlacklisted: jest.fn(async () => false) };
    const strategy = new JwtStrategy(prisma as any, blacklist as any);
    return { strategy };
  }

  it('accepts a tid the user has a membership for and uses the per-tenant role', async () => {
    const { strategy } = build({
      id: 'u1',
      email: 'o@x.com',
      name: 'O',
      role: 'OWNER',
      tenantId: 't1',
      activeTenantId: 't2',
      isSuperAdmin: false,
      memberships: [
        { tenantId: 't1', role: 'OWNER' },
        { tenantId: 't2', role: 'OPERATOR' },
      ],
    });

    const result = await strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER', tid: 't2' } as any);
    expect(result.tenantId).toBe('t2');
    expect(result.role).toBe('OPERATOR');
  });

  it('rejects a tid the user is NOT a member of (403)', async () => {
    const { strategy } = build({
      id: 'u1',
      email: 'o@x.com',
      name: 'O',
      role: 'OWNER',
      tenantId: 't1',
      activeTenantId: 't1',
      isSuperAdmin: false,
      memberships: [{ tenantId: 't1', role: 'OWNER' }],
    });

    await expect(
      strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER', tid: 'forged' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the resolved active membership is SUSPENDED, even with a valid token (403)', async () => {
    const { strategy } = build({
      id: 'u1',
      email: 'o@x.com',
      name: 'O',
      role: 'OWNER',
      tenantId: 't1',
      activeTenantId: 't2',
      isSuperAdmin: false,
      memberships: [
        { tenantId: 't1', role: 'OWNER', status: 'ACTIVE' },
        { tenantId: 't2', role: 'OPERATOR', status: 'SUSPENDED' },
      ],
    });

    await expect(
      strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER', tid: 't2' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GAPS #7: rejects a zero-membership non-super-admin (no more fallback bypass)', async () => {
    // Previously a membership-less user fell through and could forge any tid.
    const { strategy } = build({
      id: 'u1',
      email: 'o@x.com',
      name: 'O',
      role: 'OWNER',
      tenantId: 't1',
      activeTenantId: null,
      isSuperAdmin: false,
      memberships: [],
    });

    await expect(
      strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER', tid: 't1' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GAPS #7: allows a super-admin (Bemind ops) with zero memberships for any tid', async () => {
    // The bootstrap admin (provisionAdmin, isSuperAdmin:true) and Bemind ops
    // legitimately operate across tenants without a per-tenant membership.
    const { strategy } = build({
      id: 'sa',
      email: 'ops@bemind.tech',
      name: 'Ops',
      role: 'OWNER',
      tenantId: 't1',
      activeTenantId: null,
      isSuperAdmin: true,
      memberships: [],
    });

    const result = await strategy.validate({ sub: 'sa', email: 'ops@bemind.tech', role: 'OWNER', tid: 'any-tenant' } as any);
    expect(result.tenantId).toBe('any-tenant');
    expect(result.isSuperAdmin).toBe(true);
  });

  it('rejects when no tenant resolves at all', async () => {
    const { strategy } = build({
      id: 'u1',
      email: 'o@x.com',
      name: 'O',
      role: 'OWNER',
      tenantId: null,
      activeTenantId: null,
      isSuperAdmin: false,
      memberships: [],
    });

    await expect(
      strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
