import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBlacklistService } from '../token-blacklist.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { resolveTenantId } from '../../common/tenancy/tenancy.config';

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
      select: { id: true, email: true, name: true, role: true, tenantId: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Resolve the request's tenant context (SaaS phase 4.2):
    //  - self-host : always the default tenant constant.
    //  - saas      : the `tid` claim, falling back to the stored user.tenantId,
    //                then the default constant. Attached to req.user so proxy
    //                controllers can forward it via @CurrentUser('tenantId').
    const tenantId = resolveTenantId(payload.tid ?? user.tenantId);

    return { ...user, tenantId };
  }
}
