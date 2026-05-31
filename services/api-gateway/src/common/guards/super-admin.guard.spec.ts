import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

/**
 * SuperAdminGuard tests (M4/E5).
 *
 * UniCore is always multi-tenant SaaS: only User.isSuperAdmin === true may
 * proceed; a tenant OWNER is blocked. There is no self-host pass-through.
 */
describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  const ctx = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

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
