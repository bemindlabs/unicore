import { Injectable, UnauthorizedException } from '@nestjs/common';
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
      select: { id: true, email: true, name: true, role: true, tenantId: true, isSuperAdmin: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve the request's tenant context. UniCore is always multi-tenant SaaS,
    // so every authenticated request MUST carry a tenant: the `tid` claim, falling
    // back to the stored user.tenantId. A user with no resolvable tenant is an auth
    // error — never a silent default. Attached to req.user so proxy controllers can
    // forward it via @CurrentUser('tenantId').
    const tenantId = payload.tid ?? user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('No tenant associated with this account');
    }

    return { ...user, tenantId };
  }
}
