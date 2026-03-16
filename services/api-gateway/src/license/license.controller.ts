import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LicenseService } from './license.service';

/**
 * Exposes license status information to authenticated clients.
 * All routes require JWT authentication (applied globally via JwtAuthGuard).
 */
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  /**
   * GET /license/status
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
   * POST /license/activate
   * Accepts a new license key, persists it, and validates against the license server.
   */
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Body() body: { key: string }) {
    const status = await this.licenseService.activate(body.key);
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
   * POST /license/refresh
   * Forces an immediate re-validation of the current license key.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh() {
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

  /**
   * POST /license/revalidate
   * Forces an immediate re-validation against the license server.
   * Useful after updating the UNICORE_LICENSE_KEY without restarting.
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
