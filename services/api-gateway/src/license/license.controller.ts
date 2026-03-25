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
  Logger,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';
import { ActivateAddonDto } from './dto/activate-addon.dto';
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
  private readonly logger = new Logger(LicenseController.name);

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
      edition: status.edition,
      /** @deprecated Use edition instead. */
      tier: status.edition,
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
      edition: status.edition,
      /** @deprecated Use edition instead. */
      tier: status.edition,
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
    // 1. Check current edition — reject if already Pro or Enterprise
    const status = await this.licenseService.getLicenseStatus();
    if (status.edition === 'pro' || status.edition === 'enterprise') {
      throw new ConflictException('Already on Pro or Enterprise edition');
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

    const data = (await res.json()) as { url: string; sessionId: string };
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
   * POST /api/v1/license/downgrade
   * Initiates a subscription downgrade from Pro to Community via the platform API.
   * Requires JWT authentication. Only allowed when current tier is Pro.
   */
  @Post('downgrade')
  @HttpCode(HttpStatus.OK)
  async downgrade(
    @Body() body: { email?: string },
    @Req() req: any,
  ) {
    // 1. Check current edition — only allow downgrade from Pro
    const status = await this.licenseService.getLicenseStatus();
    if (status.edition !== 'pro') {
      throw new ConflictException('Downgrade is only available for Pro edition');
    }

    // 2. Call platform downgrade API
    const platformUrl =
      process.env.PLATFORM_URL || 'https://unicore.bemind.tech';
    const res = await fetch(
      `${platformUrl}/api/customer/billing/downgrade`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: body.email || req.user?.email,
        }),
      },
    );

    if (!res.ok) {
      throw new InternalServerErrorException(
        'Failed to process downgrade request',
      );
    }

    return res.json();
  }

  /**
   * GET /api/v1/license/billing
   * Returns current subscription billing details via the platform API.
   */
  @Get('billing')
  async getBilling(@Req() req: any) {
    const platformUrl =
      process.env.PLATFORM_URL || 'https://unicore.bemind.tech';
    const res = await fetch(`${platformUrl}/api/customer/billing/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: req.user?.email }),
    });

    if (!res.ok) {
      return {
        plan: null,
        interval: null,
        amount: 0,
        currency: 'usd',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentMethod: null,
      };
    }

    return res.json();
  }

  /**
   * GET /api/v1/license/invoices
   * Returns recent invoices from Stripe via the platform API.
   * Maps the platform response format to the dashboard's expected format.
   */
  @Get('invoices')
  async getInvoices(@Req() req: any) {
    const platformUrl =
      process.env.PLATFORM_URL || 'https://unicore.bemind.tech';
    const res = await fetch(`${platformUrl}/api/customer/billing/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: req.user?.email }),
    });

    if (!res.ok) {
      return { invoices: [] };
    }

    const data = (await res.json()) as { invoices?: any[] };
    // Map platform format to dashboard format
    const invoices = (data.invoices ?? []).map((inv: any) => ({
      id: inv.id,
      date: inv.created
        ? new Date(inv.created * 1000).toISOString()
        : new Date().toISOString(),
      amount: inv.amountPaid ?? inv.amountDue ?? 0,
      currency: inv.currency ?? 'usd',
      status: inv.status ?? 'unknown',
      pdfUrl: inv.pdfUrl ?? null,
    }));

    return { invoices };
  }

  /**
   * POST /api/v1/license/activate-addon
   * Activates an add-on feature (Geek CLI or AI-DLC) on the current license.
   *
   * Authentication: X-Platform-Secret header matching PLATFORM_CALLBACK_SECRET env var.
   * Called by the unicore-platform addon-worker after a successful add-on purchase.
   */
  @Post('activate-addon')
  @Public()
  @HttpCode(HttpStatus.OK)
  async activateAddon(
    @Body() dto: ActivateAddonDto,
    @Headers('x-platform-secret') platformSecret: string,
  ) {
    // Validate platform secret
    const expectedSecret = process.env.PLATFORM_CALLBACK_SECRET;
    if (!platformSecret || !expectedSecret || platformSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing X-Platform-Secret header');
    }

    try {
      await this.licenseService.activateAddon(dto.addonType);
    } catch (err) {
      this.logger.error(
        `Failed to activate add-on "${dto.addonType}": ${(err as Error).message}`,
      );
      throw new InternalServerErrorException(
        `Failed to activate add-on: ${(err as Error).message}`,
      );
    }

    return { success: true, addon: dto.addonType };
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
      edition: status.edition,
      /** @deprecated Use edition instead. */
      tier: status.edition,
      features: status.features,
      expiresAt: status.expiresAt,
      validatedAt: status.validatedAt,
      nextRevalidationAt: status.nextRevalidationAt,
    };
  }
}
