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

  function build(user: any) {
    const prisma = { user: { findUnique: jest.fn(async () => user) } };
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

  it('falls through for legacy users with no memberships (fallback)', async () => {
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

    const result = await strategy.validate({ sub: 'u1', email: 'o@x.com', role: 'OWNER', tid: 't1' } as any);
    expect(result.tenantId).toBe('t1');
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
