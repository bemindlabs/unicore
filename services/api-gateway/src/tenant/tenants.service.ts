import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthResponseDto } from '../auth/dto/auth-response.dto';
import { TRIAL_PLAN, computeTrialEnd, PLANS } from '../common/tenancy/plans.config';
import { runWithTenant } from '../common/tenancy/tenant-store';

/** One row of the current user's business list (GET /tenants). */
export interface MembershipView {
  tenantId: string;
  name: string;
  plan: string;
  role: string;
  /** The user's membership status in this tenant (ACTIVE | SUSPENDED). */
  status: string;
  /** True for the user's currently-active tenant. */
  isActive: boolean;
}

/**
 * Multi-business memberships (Phase 5 / W1a). One user can own/operate multiple
 * solopreneur businesses (tenants); each (user, tenant) link is a Membership.
 * This service lists a user's businesses, creates new ones, and performs the
 * membership-checked active-tenant switch.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** List the businesses the current user belongs to, flagging the active one. */
  async listForUser(userId: string): Promise<MembershipView[]> {
    const [user, memberships] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { activeTenantId: true, tenantId: true },
      }),
      this.prisma.membership.findMany({
        where: { userId },
        include: { tenant: { select: { id: true, name: true, plan: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const activeTenantId = user?.activeTenantId ?? user?.tenantId ?? null;

    return memberships.map((m) => ({
      tenantId: m.tenantId,
      name: m.tenant.name,
      plan: m.tenant.plan,
      role: m.role,
      status: m.status,
      isActive: m.tenantId === activeTenantId,
    }));
  }

  /**
   * Create a new business (tenant) for the current user: a fresh ACTIVE/TRIALING
   * tenant (reusing the signup trial defaults) plus an OWNER Membership. Does NOT
   * switch the active tenant — the caller can switch afterwards.
   */
  async createForUser(
    userId: string,
    name: string,
  ): Promise<MembershipView> {
    const businessName = name.trim();
    const slug = await this.generateUniqueSlug(businessName);
    const trialEndsAt = computeTrialEnd();

    const tenant = await this.prisma.tenant.create({
      data: {
        slug,
        name: businessName,
        status: 'ACTIVE',
        plan: PLANS[TRIAL_PLAN].key,
        subscriptionStatus: 'TRIALING',
        trialEndsAt,
        memberships: {
          create: { userId, role: 'OWNER' },
        },
      },
    });

    this.logger.log(
      `User ${userId} created business ${tenant.id} (${slug}) as OWNER`,
    );

    const active = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeTenantId: true, tenantId: true },
    });
    const activeTenantId = active?.activeTenantId ?? active?.tenantId ?? null;

    return {
      tenantId: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      role: 'OWNER',
      status: 'ACTIVE',
      isActive: tenant.id === activeTenantId,
    };
  }

  /**
   * Switch the current user's active tenant. VERIFIES a Membership(user, tenant)
   * exists first (403 otherwise), sets activeTenantId, then re-issues an access
   * token whose `tid` claim is the new active tenant.
   */
  async switchForUser(
    user: { id: string; email: string; name: string; role: string },
    targetTenantId: string,
  ): Promise<AuthResponseDto> {
    // memberships is RLS-FORCED (GAPS #5): the target membership is only visible
    // under the TARGET tenant's context, not the caller's current one. Pin it so
    // a legitimate switch into another business isn't hidden by the policy.
    const membership = await runWithTenant(targetTenantId, () =>
      this.prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: targetTenantId } },
      }),
    );

    if (!membership) {
      this.logger.warn(
        `Tenant switch denied: user ${user.id} has no membership for tenant ${targetTenantId}`,
      );
      throw new ForbiddenException('You are not a member of that business');
    }

    // A suspended membership is locked out of THIS business (its other
    // businesses are unaffected). Refuse to switch into it.
    if (membership.status === 'SUSPENDED') {
      this.logger.warn(
        `Tenant switch denied: user ${user.id} membership for tenant ${targetTenantId} is SUSPENDED`,
      );
      throw new ForbiddenException('Your access to that business has been suspended');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { activeTenantId: targetTenantId },
    });

    this.logger.log(
      `User ${user.id} switched active tenant → ${targetTenantId}`,
    );

    // Re-issue with the membership's role in the target tenant so the new token
    // reflects the role the user holds in the business they just switched into.
    return this.authService.issueTokensForUser({
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      activeTenantId: targetTenantId,
    });
  }

  /** Build a URL-safe, unique tenant slug from a business name. */
  private async generateUniqueSlug(base: string): Promise<string> {
    const root =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'tenant';

    let candidate = root;
    let suffix = 0;
    while (await this.prisma.tenant.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${root}-${randomBytes(2).toString('hex')}`;
      if (suffix > 5) {
        candidate = `${root}-${randomBytes(4).toString('hex')}`;
        break;
      }
    }
    return candidate;
  }
}
