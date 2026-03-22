import type { BrandingConfig, BrandingPreset } from './types';
export declare const DEFAULT_PRESET_ID = "unicore-default";
export declare const BRANDING_PRESETS: readonly BrandingPreset[];
/**
 * Look up a preset by ID. Returns undefined if not found.
 */
export declare function findPreset(id: string): BrandingPreset | undefined;
/**
 * Return the default UniCore preset config merged with the given appName.
 */
export declare function getDefaultConfig(appName?: string): BrandingConfig;
//# sourceMappingURL=presets.d.ts.map