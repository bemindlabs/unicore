import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { isSaaS } from '../tenancy/tenancy.config';

/**
 * Super-admin boundary for the SaaS control plane (M4/E5).
 *
 * Distinguishes **Bemind platform ops** (who may administer every tenant via the
 * `/api/v1/admin/*` control-plane endpoints) from a tenant **OWNER** (who only
 * governs their own workspace). The boundary is modeled as a single lean
 * `User.isSuperAdmin` boolean flag — set out-of-band by Bemind ops — rather than
 * a new Role enum member, so it stays orthogonal to the tenant-scoped RBAC roles
 * (OWNER/OPERATOR/…). The flag is read live from the DB on every request by the
 * JWT strategy, so it can never go stale in an issued token.
 *
 * Mode behavior (mirrors {@link SuspendedTenantGuard}):
 *  - **self-host** (default, open-core): unconditional pass-through. There is no
 *    cross-tenant control plane to protect — the single OWNER administers their
 *    own instance exactly as before. Self-host is never locked out.
 *  - **saas**: only users with `isSuperAdmin === true` may proceed; a tenant
 *    OWNER (or any other role) is rejected with 403.
 *
 * Apply with `@UseGuards(SuperAdminGuard)`; controller-bound guards run after the
 * global `JwtAuthGuard`, so `req.user` is already resolved.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Self-host has no cross-tenant control plane — the single OWNER administers
    // their own instance. Never lock self-host out.
    if (!isSaaS()) return true;

    const req = context.switchToHttp().getRequest();

    // Internal service-to-service calls carry their own trust header.
    if (req.headers?.['x-internal-service']) return true;

    const user = req.user as { isSuperAdmin?: boolean } | undefined;
    if (user?.isSuperAdmin === true) return true;

    throw new ForbiddenException(
      'Platform super-admin privileges are required for the control plane.',
    );
  }
}
