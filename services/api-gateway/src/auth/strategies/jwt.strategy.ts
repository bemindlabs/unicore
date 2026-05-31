import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../token-blacklist.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { runWithTenant } from '../../common/tenancy/tenant-store';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    // Check if the token has been revoked (logout blacklist)
    if (payload.jti) {
      const revoked = await this.tokenBlacklist.isBlacklisted(payload.jti);
      if (revoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        activeTenantId: true,
        isSuperAdmin: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve the request's tenant context. UniCore is always multi-tenant SaaS,
    // so every authenticated request MUST carry a tenant: the `tid` claim, falling
    // back to the stored activeTenantId then the home tenantId. A user with no
    // resolvable tenant is an auth error — never a silent default. Attached to
    // req.user so proxy controllers can forward it via @CurrentUser('tenantId').
    const tenantId = payload.tid ?? user.activeTenantId ?? user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('No tenant associated with this account');
    }

    // GAPS #5 + #7: the `memberships` table is RLS-FORCED (apply-rls.sql). Auth
    // runs BEFORE any tenant context is established, so loading memberships off
    // the bare user query would run under the DEMO context and the policy would
    // hide EVERY row — locking out every legitimate non-super-admin once the app
    // connects as the required NOSUPERUSER role. We therefore read the user's
    // membership for the RESOLVED tenant under that tenant's RLS context, so the
    // row is visible exactly when (and only when) it belongs to this user+tenant.
    const activeMembership = await runWithTenant(tenantId, () =>
      this.prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId } },
        select: { tenantId: true, role: true, status: true },
      }),
    );

    // GAPS #7: the resolved tenant MUST be one the user actually belongs to.
    // The previous `memberships.length > 0 && …` form left a hole: a user with
    // ZERO memberships skipped the check entirely and could forge any `tid`.
    // Now membership is ALWAYS required — the only exemption is a platform
    // super-admin (Bemind ops), who legitimately operates across every tenant
    // (this also keeps the secret-gated bootstrap admin, provisioned with
    // isSuperAdmin:true, working). Every legitimate signup/oauth/register path
    // creates a Membership (Phase 5 / Stage A), so no normal user is locked out;
    // a membership-less non-super-admin is rejected with 403.
    if (!user.isSuperAdmin && !activeMembership) {
      throw new ForbiddenException('Not a member of the active business');
    }

    // Enforce persisted per-tenant suspension (Phase 5): a SUSPENDED membership
    // can't operate this tenant even with a stale/replayed token. Scoped to the
    // active tenant only — the user's other businesses are unaffected.
    if (activeMembership?.status === 'SUSPENDED') {
      throw new ForbiddenException('Your access to the active business has been suspended');
    }

    const role = activeMembership?.role ?? user.role;

    return { ...user, role, tenantId };
  }
}
