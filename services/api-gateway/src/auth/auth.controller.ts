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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';
import { LoginDto } from './dto/login.dto';
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
    const user = req.user as { id: string; email: string; name: string; role: string };
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
    const user = req.user as { id: string; email: string; name: string; role: string };
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
