import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LicenseService } from './license.service';
import { ActivateLicenseDto } from './dto/activate-license.dto';

/**
 * Exposes license status information to authenticated clients.
 * All routes require JWT authentication (applied globally via JwtAuthGuard).
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
   */
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Body() dto: ActivateLicenseDto) {
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
