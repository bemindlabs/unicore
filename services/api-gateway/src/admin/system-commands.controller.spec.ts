import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SystemCommandsController } from './system-commands.controller';
import { AdminController } from './admin.controller';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

/**
 * GAPS #2: /api/v1/admin/system/* runs `docker restart` / `docker logs` /
 * `docker exec kafka` on the SHARED cluster. It must be gated by SuperAdminGuard
 * (Bemind platform ops), not merely @Roles('OWNER') — a tenant OWNER could
 * otherwise restart shared infra. We assert the guard is bound at the class
 * level via NestJS metadata, and that SuperAdminGuard itself blocks a non-super
 * OWNER.
 */
describe('SystemCommandsController guard wiring (GAPS #2)', () => {
  it('binds SuperAdminGuard at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SystemCommandsController) ?? [];
    expect(guards).toContain(SuperAdminGuard);
  });

  it('no longer relies on @Roles(OWNER) for the control-plane boundary', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SystemCommandsController);
    expect(roles).toBeUndefined();
  });

  it('a non-super-admin OWNER is rejected by SuperAdminGuard', () => {
    const guard = new SuperAdminGuard();
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'OWNER', isSuperAdmin: false } }) }),
    };
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});

/**
 * GAPS #2/L1: AdminController dropped the redundant @Roles('OWNER') that
 * shadowed SuperAdminGuard (the global RolesGuard would wrongly reject a
 * super-admin whose active-tenant role is not OWNER).
 */
describe('AdminController guard wiring (GAPS #2/L1)', () => {
  it('binds SuperAdminGuard and no longer carries @Roles', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) ?? [];
    expect(guards).toContain(SuperAdminGuard);
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toBeUndefined();
  });
});
