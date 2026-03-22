import type { BrandingConfig, BrandingFont, CssGeneratorOptions } from './types';
/** Map a color key to a CSS variable name */
export declare const COLOR_VAR_MAP: Record<string, string>;
export declare const FONT_VAR_MAP: Record<string, string>;
/**
 * Attempt to derive a Tailwind-compatible HSL triple from a hex color.
 * Returns null if the value cannot be parsed as a 6-digit hex.
 */
export declare function hexToHslComponents(hex: string): string | null;
/**
 * Build a Google Fonts @import URL for a font definition, if possible.
 * Returns null if the font has a custom URL (handled separately).
 */
export declare function buildGoogleFontImport(font: BrandingFont): string | null;
/**
 * Generate the complete CSS theme string from a BrandingConfig.
 * Handles colors, fonts, and app-name. Pro features (customCss,
 * removeUnicoreBranding, logos) are handled by the Pro branding package.
 */
export declare function generateCssTheme(config: BrandingConfig, options?: CssGeneratorOptions): string;
/**
 * Generate only the CSS custom property declarations (without selector wrapper).
 * Useful for injecting into inline styles or SSR style tags.
 */
export declare function generateCssVariables(config: BrandingConfig): Record<string, string>;
//# sourceMappingURL=css-generator.d.ts.map