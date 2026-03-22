// @unicore/branding — Community edition public API
// Base branding: colors, fonts, dark/light mode

// Types
export type {
  BrandingConfig,
  BrandingConfigPatch,
  BrandingColors,
  BrandingFont,
  BrandingPreset,
  CssGeneratorOptions,
  FontWeight,
} from './types';

export type {
  TailwindColorScale,
  TailwindThemeExtension,
} from './tailwind';

// Service & storage
export { BrandingService, MemoryBrandingStorage } from './service';
export type { BrandingStorage, BrandingServiceOptions } from './service';

// CSS generator
export {
  generateCssTheme,
  generateCssVariables,
  COLOR_VAR_MAP,
  FONT_VAR_MAP,
  hexToHslComponents,
  buildGoogleFontImport,
} from './css-generator';

// Tailwind integration
export { brandingToTailwindTheme, brandingToCssVarTailwindTheme } from './tailwind';

// Presets
export {
  BRANDING_PRESETS,
  DEFAULT_PRESET_ID,
  findPreset,
  getDefaultConfig,
} from './presets';
