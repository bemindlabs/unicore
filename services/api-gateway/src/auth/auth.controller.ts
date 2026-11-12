import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { SignupDto } from './dto/signup.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuditService } from '../audit/audit.service';
import { LicenseService } from '../license/license.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly licenseService: LicenseService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Self-serve SaaS signup (M3/E3): creates a Tenant + OWNER User, starts the
   * 30-day free trial (no card), and logs the user in. Public, saas-mode only.
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    const result = await this.authService.signup(dto);
    await this.auditService.log({
      userId: result.user.id,
      userEmail: result.user.email,
      action: 'create',
      resource: 'tenants',
      detail: `SaaS signup + 30-day trial started`,
      ip: req.ip,
    });
    return result;
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@CurrentUser() user: any, @Body() _dto: LoginDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(user);
      await this.auditService.log({
        userId: user.id,
        userEmail: user.email,
        action: 'login',
        resource: 'auth',
        detail: 'Login successful',
        ip: req.ip,
      });
      return result;
    } catch (err) {
      await this.auditService.log({
        userEmail: _dto.email,
        action: 'login',
        resource: 'auth',
        success: false,
        detail: 'Invalid credentials',
        ip: req.ip,
      });
      throw err;
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // Password reset + email verification (GAPS #8). Tenant-agnostic identity
  // endpoints — all Public. forgot-password ALWAYS returns 200 (no enumeration).
  // ---------------------------------------------------------------------------

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const result = await this.authService.forgotPassword(dto.email);
    // Non-enumerating audit: record the request, never whether the user existed.
    await this.auditService.log({
      userEmail: dto.email,
      action: 'password-reset-request',
      resource: 'auth',
      detail: 'Password reset requested',
      ip: req.ip,
    });
    return result;
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    await this.auditService.log({
      action: 'password-reset',
      resource: 'auth',
      detail: 'Password reset via token; sessions revoked',
      ip: req.ip,
    });
    return result;
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const result = await this.authService.verifyEmail(dto.token);
    await this.auditService.log({
      action: 'email-verify',
      resource: 'auth',
      detail: 'Email verified via token',
      ip: req.ip,
    });
    return result;
  }

  @Public()
  @Post('token-exchange')
  @HttpCode(HttpStatus.OK)
  async tokenExchange(@Body() dto: TokenExchangeDto, @Req() req: Request) {
    try {
      const result = await this.authService.tokenExchange(
        dto.platformToken,
        dto.targetApp,
      );
      await this.auditService.log({
        userId: result.user.id,
        userEmail: result.user.email,
        action: 'token-exchange',
        resource: 'auth',
        detail: `Cross-domain token exchange${dto.targetApp ? ` for ${dto.targetApp}` : ''}`,
        ip: req.ip,
      });
      return result;
    } catch (err) {
      await this.auditService.log({
        action: 'token-exchange',
        resource: 'auth',
        success: false,
        detail: `Token exchange failed: ${(err as Error).message}`,
        ip: req.ip,
      });
      throw err;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any, @Body() dto: RefreshTokenDto, @Req() req: Request) {
    // Extract the access token from the Authorization header for blacklisting
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const result = await this.authService.logout(dto.refreshToken, accessToken);
    await this.auditService.log({
      userId: user?.id,
      userEmail: user?.email,
      action: 'logout',
      resource: 'auth',
      detail: 'Logout',
      ip: req.ip,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    const [user, status] = await Promise.all([
      this.authService.getMe(userId),
      this.licenseService.getLicenseStatus(),
    ]);
    return {
      ...user,
      license: {
        tier: status.edition,
        features: status.features,
        expiresAt: status.expiresAt,
        isValid: status.valid,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.updateProfile(userId, dto);
    await this.auditService.log({
      userId,
      userEmail: user?.email,
      action: 'update',
      resource: 'users',
      resourceId: userId,
      detail: `Profile updated`,
      ip: req.ip,
    });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const result = await this.authService.changePassword(userId, dto);
    await this.auditService.log({
      userId,
      userEmail: user?.email,
      action: 'update',
      resource: 'users',
      resourceId: userId,
      detail: 'Password changed',
      ip: req.ip,
    });
    return result;
  }

  @Public()
  @Post('provision-admin')
  @HttpCode(HttpStatus.CREATED)
  async provisionAdmin(
    @Headers('x-bootstrap-secret') secret: string,
    @Body() body: { email: string; name: string; password: string; role?: 'OWNER' | 'OPERATOR' },
    @Req() req: Request,
  ) {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid bootstrap secret');
    }
    const result = await this.authService.provisionAdmin(
      body.email,
      body.name,
      body.password,
      body.role ?? 'OWNER',
    );
    await this.auditService.log({
      userEmail: body.email,
      action: 'create',
      resource: 'users',
      detail: `Admin provisioned: ${body.email} (${body.role ?? 'OWNER'})`,
      ip: req.ip,
    });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  googleLogin() {
    // Guard redirects to Google consent screen
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId?: string | null;
      activeTenantId?: string | null;
    };
    const tokens = await this.authService.login(user);
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      resource: 'auth',
      detail: 'Google OAuth login',
      ip: req.ip,
    });
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    res.redirect(`${dashboardUrl}/auth/oauth-callback?${params.toString()}`);
  }

  // ---------------------------------------------------------------------------
  // GitHub OAuth
  // ---------------------------------------------------------------------------

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github')
  githubLogin() {
    // Guard redirects to GitHub authorization page
  }

  @Public()
  @UseGuards(GithubAuthGuard)
  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as {
      id: string;
      email: string;
      name: string;
      role: string;
      tenantId?: string | null;
      activeTenantId?: string | null;
    };
    const tokens = await this.authService.login(user);
    await this.auditService.log({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      resource: 'auth',
      detail: 'GitHub OAuth login',
      ip: req.ip,
    });
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
    res.redirect(`${dashboardUrl}/auth/oauth-callback?${params.toString()}`);
  }
}
