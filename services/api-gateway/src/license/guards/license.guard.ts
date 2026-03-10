import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LicenseService } from '../license.service';
import { PRO_FEATURE_KEY } from '../decorators/pro-feature.decorator';
import type { ProFeature } from '../interfaces/license.interface';

/**
 * LicenseGuard gates access to Pro feature endpoints.
 *
 * Apply @ProFeatureRequired('<feature>') to a controller or route handler,
 * then add @UseGuards(LicenseGuard) to enforce the check.
 *
 * Routes with no @ProFeatureRequired metadata pass through unaffected.
 *
 * @example
 * \@ProFeatureRequired('rbac')
 * \@UseGuards(LicenseGuard)
 * \@Get('rbac-settings')
 * getRbacSettings() { ... }
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  private readonly logger = new Logger(LicenseGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly licenseService: LicenseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<
      ProFeature | undefined
    >(PRO_FEATURE_KEY, [context.getHandler(), context.getClass()]);

    // No feature requirement — allow through
    if (!requiredFeature) {
      return true;
    }

    const allowed = await this.licenseService.hasFeature(requiredFeature);

    if (!allowed) {
      const status = await this.licenseService.getLicenseStatus();
      this.logger.warn(
        `Access denied to Pro feature "${requiredFeature}" — current tier: ${status.tier}`,
      );
      throw new ForbiddenException(
        `This feature requires a Pro or Enterprise license. ` +
          `Current tier: ${status.tier}. ` +
          `Set UNICORE_LICENSE_KEY to activate Pro features.`,
      );
    }

    return true;
  }
}
