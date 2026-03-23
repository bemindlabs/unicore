import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { AuditModule } from '../audit/audit.module';
import { LicenseModule } from '../license/license.module';

// Only register OAuth strategies when credentials are configured
const oauthProviders: Provider[] = [];
if (process.env.GOOGLE_CLIENT_ID) {
  oauthProviders.push(GoogleStrategy);
}
if (process.env.GITHUB_CLIENT_ID) {
  oauthProviders.push(GithubStrategy);
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    AuditModule,
    LicenseModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    ...oauthProviders,
    JwtAuthGuard,
    RolesGuard,
    TokenBlacklistService,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, TokenBlacklistService],
})
export class AuthModule {}
