import type { BrandingConfig } from './types';
export interface TailwindColorScale {
    DEFAULT: string;
}
export interface TailwindThemeExtension {
    colors: {
        brand: {
            primary: TailwindColorScale;
            secondary: TailwindColorScale;
            accent: TailwindColorScale;
            background: TailwindColorScale;
            surface: TailwindColorScale;
            foreground: TailwindColorScale;
            muted: TailwindColorScale;
            border: TailwindColorScale;
            destructive: TailwindColorScale;
            'on-primary': TailwindColorScale;
        };
    };
    fontFamily: {
        body?: string[];
        heading?: string[];
        mono?: string[];
    };
}
/**
 * Convert a BrandingConfig into a Tailwind `theme.extend` object.
 *
 * Usage in tailwind.config.ts:
 * ```ts
 * import { brandingToTailwindTheme } from '@unicore/branding';
 * const branding = await loadBrandingConfig();
 * export default { theme: { extend: brandingToTailwindTheme(branding) } };
 * ```
 *
 * For runtime theme switching without rebuilding Tailwind, use
 * `brandingToCssVarTailwindTheme()` instead.
 */
export declare function brandingToTailwindTheme(config: BrandingConfig): TailwindThemeExtension;
/**
 * Generate a Tailwind theme extension that uses CSS variable references.
 * This enables runtime theme switching without rebuilding Tailwind.
 *
 * Colors are referenced as `var(--color-primary)` etc., so they update
 * automatically when the CSS variables change.
 */
export declare function brandingToCssVarTailwindTheme(): TailwindThemeExtension;
//# sourceMappingURL=tailwind.d.ts.map