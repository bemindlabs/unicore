import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Exposes license status information to authenticated clients.
 * All routes require JWT authentication (applied globally via JwtAuthGuard)
 * unless explicitly marked @Public().
 *
 * Route prefix: api/v1/license
 */
@Controller('api/v1/license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  /**
   * GET /api/v1/license/status
   * Returns the current license status including tier and available features.
   */
  @Get('status')
  async getStatus() {
    const status = await this.licenseService.getLicenseStatus();
    return {
      valid: status.valid,
      tier: status.tier,
      features: status.features,
      expiresAt: status.expiresAt,
      nextRevalidationAt: status.nextRevalidationAt,
    };
  }

  /**
   * POST /api/v1/license/activate
   * Accepts a new license key, persists it, and validates against the license server.
   *
   * Supports two authentication modes:
   * - JWT auth: authenticated user calling from the dashboard
   * - Platform callback: X-Platform-Secret header matching PLATFORM_CALLBACK_SECRET env var
   */
  @Post('activate')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async activate(
    @Body() dto: ActivateLicenseDto,
    @Headers('x-platform-secret') platformSecret: string,
    @Req() req: any,
  ) {
    const validPlatformCall =
      platformSecret &&
      process.env.PLATFORM_CALLBACK_SECRET &&
      platformSecret === process.env.PLATFORM_CALLBACK_SECRET;
    const validUserCall = req.user;

    if (!validPlatformCall && !validUserCall) {
      throw new UnauthorizedException(
        'Valid JWT or X-Platform-Secret header required',
      );
    }

    const status = await this.licenseService.activate(dto.key);
    return {
      valid: status.valid,
      tier: status.tier,
      features: status.features,
      expiresAt: status.expiresAt,
      validatedAt: status.validatedAt,
      nextRevalidationAt: status.nextRevalidationAt,
    };
  }

  /**
   * POST /api/v1/license/upgrade
   * Initiates a plan upgrade by creating a checkout session on the platform.
   * Requires JWT authentication.
   */
  @Post('upgrade')
  @HttpCode(HttpStatus.OK)
  async upgrade(
    @Body() body: { plan: 'PRO_MONTHLY' | 'PRO_ANNUAL'; email: string },
    @Req() req: any,
  ) {
    // 1. Check current tier — reject if already Pro or Enterprise
    const status = await this.licenseService.getLicenseStatus();
    if (status.tier === 'pro' || status.tier === 'enterprise') {
      throw new ConflictException('Already on Pro or Enterprise tier');
    }

    // 2. Determine instance URL from request or env
    const instanceUrl =
      process.env.NEXT_PUBLIC_API_URL || `https://${req.headers.host}`;

    // 3. Call platform checkout API
    const platformUrl =
      process.env.PLATFORM_URL || 'https://unicore.bemind.tech';
    const res = await fetch(`${platformUrl}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: body.plan,
        customerEmail: body.email || req.user?.email,
        customerName: req.user?.name || '',
        instanceUrl,
        flowType: 'upgrade',
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }

    const data = await res.json();
    return { url: data.url, sessionId: data.sessionId };
  }

  /**
   * POST /api/v1/license/billing-portal
   * Creates a Stripe billing portal session via the platform API.
   * Requires JWT authentication.
   */
  @Post('billing-portal')
  @HttpCode(HttpStatus.OK)
  async billingPortal(
    @Body() body: { email?: string },
    @Req() req: any,
  ) {
    const platformUrl =
      process.env.PLATFORM_URL || 'https://unicore.bemind.tech';
    const res = await fetch(`${platformUrl}/api/billing/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: body.email || req.user?.email,
      }),
    });

    if (!res.ok) {
      throw new InternalServerErrorException(
        'Failed to create portal session',
      );
    }

    return res.json();
  }

  /**
   * POST /api/v1/license/revalidate
   * Forces an immediate re-validation against the license server.
   * Useful after updating the license key without restarting.
   */
  @Post('revalidate')
  @HttpCode(HttpStatus.OK)
  async revalidate() {
    const status = await this.licenseService.revalidate();
    return {
      valid: status.valid,
      tier: status.tier,
      features: status.features,
      expiresAt: status.expiresAt,
      validatedAt: status.validatedAt,
      nextRevalidationAt: status.nextRevalidationAt,
    };
  }
}
