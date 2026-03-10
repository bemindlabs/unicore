import { SetMetadata } from '@nestjs/common';
import type { ProFeature } from '../interfaces/license.interface';

export const PRO_FEATURE_KEY = 'proFeature';

/**
 * Marks a route as requiring a specific Pro feature gate.
 * Use in combination with LicenseGuard.
 *
 * @example
 * \@ProFeatureRequired('rbac')
 * \@UseGuards(LicenseGuard)
 * \@Get('rbac-settings')
 * getRbacSettings() { ... }
 */
export const ProFeatureRequired = (feature: ProFeature) =>
  SetMetadata(PRO_FEATURE_KEY, feature);
