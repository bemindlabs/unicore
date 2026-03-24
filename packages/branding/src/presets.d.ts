import { DEFAULT_PRESET_ID } from '@bemindlabs/unicore-branding-base/presets';
import type { BrandingConfig, BrandingPreset } from './types';
export { DEFAULT_PRESET_ID };
export declare const BRANDING_PRESETS: readonly BrandingPreset[];
/**
 * Look up a preset by ID. Returns undefined if not found.
 */
export declare function findPreset(id: string): BrandingPreset | undefined;
/**
 * Return the default UniCore preset config merged with the given appName and flags.
 */
export declare function getDefaultConfig(appName?: string): BrandingConfig;
//# sourceMappingURL=presets.d.ts.map