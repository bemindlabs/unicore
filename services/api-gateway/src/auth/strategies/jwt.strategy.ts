import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../token-blacklist.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

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
        memberships: { select: { tenantId: true, role: true, status: true } },
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

    // GAPS #7: the resolved tenant MUST be one the user actually belongs to.
    // The previous `memberships.length > 0 && …` form left a hole: a user with
    // ZERO memberships skipped the check entirely and could forge any `tid`.
    // Now membership is ALWAYS required — the only exemption is a platform
    // super-admin (Bemind ops), who legitimately operates across every tenant
    // (this also keeps the secret-gated bootstrap admin, provisioned with
    // isSuperAdmin:true, working). Every legitimate signup/oauth/register path
    // creates a Membership (Phase 5 / Stage A), so no normal user is locked out;
    // a membership-less non-super-admin is rejected with 403.
    const { memberships, ...rest } = user;
    if (
      !rest.isSuperAdmin &&
      !memberships.some((m) => m.tenantId === tenantId)
    ) {
      throw new ForbiddenException('Not a member of the active business');
    }

    // Surface the user's role WITHIN the active tenant when a membership exists,
    // so per-tenant role checks reflect the business they are operating.
    const activeMembership = memberships.find((m) => m.tenantId === tenantId);

    // Enforce persisted per-tenant suspension (Phase 5): a SUSPENDED membership
    // can't operate this tenant even with a stale/replayed token. Scoped to the
    // active tenant only — the user's other businesses are unaffected.
    if (activeMembership?.status === 'SUSPENDED') {
      throw new ForbiddenException('Your access to the active business has been suspended');
    }

    const role = activeMembership?.role ?? rest.role;

    return { ...rest, role, tenantId };
  }
}
