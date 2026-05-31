import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PRO_FEATURE_KEY } from '../decorators/pro-feature.decorator';
import type { ProFeature } from '../interfaces/license.interface';
import { featureFlagsForTenant } from '../../common/tenancy/plans.config';
import { DEMO_TENANT_ID } from '../../common/tenancy/tenancy.config';

/**
 * LicenseGuard gates access to plan-restricted feature endpoints PER TENANT.
 *
 * Apply @ProFeatureRequired('<feature>') to a controller or route handler,
 * then add @UseGuards(LicenseGuard) to enforce the check.
 *
 * Routes with no @ProFeatureRequired metadata pass through unaffected.
 *
 * GAPS #3: gating is driven by the REQUEST TENANT's own `plan` (+ trial state),
 * NOT the process-global UNICORE_EDITION. The tenant is resolved from
 * `req.user.tenantId` (set by jwt.strategy from the `tid` claim / activeTenantId).
 * Its plan → feature flags are mapped via {@link featureFlagsForTenant}
 * (STARTER → community flags, GROWTH → pro flags, TRIALING → full Growth). So a
 * STARTER tenant is denied a Growth-only feature while a GROWTH/trial tenant —
 * even one served by the same process — is allowed.
 *
 * Mirrors the per-tenant rate-limit guard: internal service-to-service calls
 * (`x-internal-service`), super-admins (Bemind ops), and the local/demo tenant
 * are exempt so the super-admin control plane and bootstrap keep working.
 *
 * @example
 * \@ProFeatureRequired('fullRbac')
 * \@UseGuards(LicenseGuard)
 * \@Get('rbac-settings')
 * getRbacSettings() { ... }
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);

  /** Short cache of tenant → {plan, subscriptionStatus} so we don't hit the DB every request. */
  private readonly planCache = new Map<
    string,
    { plan: string; subscriptionStatus: string; at: number }
  >();
  private static readonly PLAN_TTL_MS = 30_000;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<
      ProFeature | undefined
    >(PRO_FEATURE_KEY, [context.getHandler(), context.getClass()]);

    // No feature requirement — allow through.
    if (!requiredFeature) {
      return true;
    }

    const req = context.switchToHttp().getRequest();

    // Internal service-to-service calls carry their own trust header.
    if (req?.headers?.['x-internal-service']) return true;

    const user = req?.user as
      | { tenantId?: string; isSuperAdmin?: boolean }
      | undefined;

    // Platform super-admins (Bemind ops) operate across every tenant.
    if (user?.isSuperAdmin) return true;

    const tenantId = user?.tenantId;
    // The local/demo bootstrap tenant is not metered/gated.
    if (tenantId === DEMO_TENANT_ID) return true;

    if (!tenantId) {
      // Authenticated routes always carry a tenant; a feature-gated route with
      // no resolvable tenant is denied rather than silently allowed.
      this.logger.warn(
        `Access denied to feature "${requiredFeature}" — no tenant on request`,
      );
      throw new ForbiddenException(
        'No tenant context for this request; cannot evaluate plan entitlements.',
      );
    }

    const tenant = await this.resolveTenant(tenantId);
    const flags = featureFlagsForTenant(tenant);

    if (!flags.includes(requiredFeature)) {
      this.logger.warn(
        `Access denied to feature "${requiredFeature}" for tenant ${tenantId} ` +
          `(plan=${tenant.plan}, subscription=${tenant.subscriptionStatus})`,
      );
      throw new ForbiddenException(
        `This feature requires the Growth plan. ` +
          `Your business is on the ${tenant.plan} plan. ` +
          `Upgrade to Growth to unlock it.`,
      );
    }

    return true;
  }

  private async resolveTenant(
    tenantId: string,
  ): Promise<{ plan: string; subscriptionStatus: string }> {
    const cached = this.planCache.get(tenantId);
    if (cached && Date.now() - cached.at < LicenseGuard.PLAN_TTL_MS) {
      return cached;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, subscriptionStatus: true },
    });
    const resolved = {
      plan: tenant?.plan ?? 'STARTER',
      subscriptionStatus: tenant?.subscriptionStatus ?? 'TRIALING',
    };
    this.planCache.set(tenantId, { ...resolved, at: Date.now() });
    return resolved;
  }
}
