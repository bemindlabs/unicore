"use strict";
// Tailwind CSS theme integration for @unicore/branding (community edition)
// Converts a BrandingConfig into a Tailwind `theme.extend` compatible object.
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandingToTailwindTheme = brandingToTailwindTheme;
exports.brandingToCssVarTailwindTheme = brandingToCssVarTailwindTheme;
function scale(value, fallback = 'transparent') {
    return { DEFAULT: value ?? fallback };
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
function brandingToTailwindTheme(config) {
    const c = config.colors;
    const fontFamily = {};
    if (config.bodyFont) {
        fontFamily['body'] = [config.bodyFont.family, 'ui-sans-serif', 'sans-serif'];
    }
    const headingFont = config.headingFont ?? config.bodyFont;
    if (headingFont) {
        fontFamily['heading'] = [headingFont.family, 'ui-sans-serif', 'sans-serif'];
    }
    if (config.monoFont) {
        fontFamily['mono'] = [config.monoFont.family, 'ui-monospace', 'monospace'];
    }
    return {
        colors: {
            brand: {
                primary: scale(c.primary),
                secondary: scale(c.secondary),
                accent: scale(c.accent),
                background: scale(c.background),
                surface: scale(c.surface),
                foreground: scale(c.foreground),
                muted: scale(c.muted),
                border: scale(c.border),
                destructive: scale(c.destructive),
                'on-primary': scale(c.onPrimary),
            },
        },
        fontFamily,
    };
}
/**
 * Generate a Tailwind theme extension that uses CSS variable references.
 * This enables runtime theme switching without rebuilding Tailwind.
 *
 * Colors are referenced as `var(--color-primary)` etc., so they update
 * automatically when the CSS variables change.
 */
function brandingToCssVarTailwindTheme() {
    function cssVar(varName) {
        return { DEFAULT: `var(${varName})` };
    }
    return {
        colors: {
            brand: {
                primary: cssVar('--color-primary'),
                secondary: cssVar('--color-secondary'),
                accent: cssVar('--color-accent'),
                background: cssVar('--color-background'),
                surface: cssVar('--color-surface'),
                foreground: cssVar('--color-foreground'),
                muted: cssVar('--color-muted'),
                border: cssVar('--color-border'),
                destructive: cssVar('--color-destructive'),
                'on-primary': cssVar('--color-on-primary'),
            },
        },
        fontFamily: {
            body: ['var(--font-body)', 'ui-sans-serif', 'sans-serif'],
            heading: ['var(--font-heading)', 'ui-sans-serif', 'sans-serif'],
            mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        },
    };
}
//# sourceMappingURL=tailwind.js.map