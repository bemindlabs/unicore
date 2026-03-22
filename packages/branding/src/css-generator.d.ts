import type { BrandingConfig, CssGeneratorOptions } from './types';
/**
 * Generate the complete CSS theme string from a pro BrandingConfig.
 * Handles all community features (colors, fonts, app-name) plus pro features:
 * - removeUnicoreBranding flag and [data-unicore-branding] hide rule
 * - customCss injection
 */
export declare function generateCssTheme(config: BrandingConfig, options?: CssGeneratorOptions): string;
/**
 * Generate only the CSS custom property declarations (without selector wrapper).
 * Extends the community base with pro-specific variables.
 */
export declare function generateCssVariables(config: BrandingConfig): Record<string, string>;
//# sourceMappingURL=css-generator.d.ts.map