import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

/**
 * SuperAdminGuard tests (M4/E5).
 *
 * - self-host (default): unconditional pass-through — the single OWNER is never
 *   locked out of the admin surface.
 * - saas: only User.isSuperAdmin === true may proceed; a tenant OWNER is blocked.
 */
describe('SuperAdminGuard', () => {
  const original = process.env.DEPLOYMENT_MODE;
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  afterEach(() => {
    process.env.DEPLOYMENT_MODE = original;
  });

  const ctx = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  it('passes through in self-host mode for a plain OWNER (never locks self-host out)', () => {
    process.env.DEPLOYMENT_MODE = 'self-host';
    const req = { user: { role: 'OWNER', isSuperAdmin: false } };
    expect(guard.canActivate(ctx(req))).toBe(true);
  });

  it('passes through in self-host mode even with no user', () => {
    process.env.DEPLOYMENT_MODE = 'self-host';
    expect(guard.canActivate(ctx({}))).toBe(true);
  });

  describe('saas mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'saas';
    });

    it('allows a platform super-admin', () => {
      const req = { user: { role: 'OWNER', isSuperAdmin: true } };
      expect(guard.canActivate(ctx(req))).toBe(true);
    });

    it('blocks a tenant OWNER who is not a super-admin', () => {
      const req = { user: { role: 'OWNER', isSuperAdmin: false } };
      expect(() => guard.canActivate(ctx(req))).toThrow(ForbiddenException);
    });

    it('blocks when there is no resolved user', () => {
      expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
    });

    it('allows internal service-to-service calls via x-internal-service header', () => {
      const req = { headers: { 'x-internal-service': 'ai-engine' }, user: undefined };
      expect(guard.canActivate(ctx(req))).toBe(true);
    });
  });
});
