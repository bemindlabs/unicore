"use strict";
// CSS theme generator for @unicore/branding (community edition)
// Converts BrandingConfig → CSS custom properties (variables) + font imports
Object.defineProperty(exports, "__esModule", { value: true });
exports.FONT_VAR_MAP = exports.COLOR_VAR_MAP = void 0;
exports.hexToHslComponents = hexToHslComponents;
exports.buildGoogleFontImport = buildGoogleFontImport;
exports.generateCssTheme = generateCssTheme;
exports.generateCssVariables = generateCssVariables;
/** Map a color key to a CSS variable name */
exports.COLOR_VAR_MAP = {
    primary: '--color-primary',
    secondary: '--color-secondary',
    accent: '--color-accent',
    background: '--color-background',
    surface: '--color-surface',
    onPrimary: '--color-on-primary',
    foreground: '--color-foreground',
    muted: '--color-muted',
    border: '--color-border',
    destructive: '--color-destructive',
};
exports.FONT_VAR_MAP = {
    body: '--font-body',
    heading: '--font-heading',
    mono: '--font-mono',
};
/**
 * Attempt to derive a Tailwind-compatible HSL triple from a hex color.
 * Returns null if the value cannot be parsed as a 6-digit hex.
 */
function hexToHslComponents(hex) {
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6)
        return null;
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    if (delta !== 0) {
        switch (max) {
            case r:
                h = ((g - b) / delta) % 6;
                break;
            case g:
                h = (b - r) / delta + 2;
                break;
            case b:
                h = (r - g) / delta + 4;
                break;
        }
        h = Math.round(h * 60);
        if (h < 0)
            h += 360;
    }
    return `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
/**
 * Build a Google Fonts @import URL for a font definition, if possible.
 * Returns null if the font has a custom URL (handled separately).
 */
function buildGoogleFontImport(font) {
    if (font.url)
        return null;
    const weights = font.weights?.map((w) => {
        const map = {
            thin: '100',
            light: '300',
            regular: '400',
            medium: '500',
            semibold: '600',
            bold: '700',
            extrabold: '800',
        };
        return map[w] ?? '400';
    }) ?? ['400', '500', '600', '700'];
    const family = font.family.replace(/\s+/g, '+');
    return `@import url('https://fonts.googleapis.com/css2?family=${family}:wght@${weights.join(';')}&display=swap');`;
}
function fontToCssVar(varName, font) {
    return `  ${varName}: '${font.family}', sans-serif;`;
}
/**
 * Generate the complete CSS theme string from a BrandingConfig.
 * Handles colors, fonts, and app-name. Pro features (customCss,
 * removeUnicoreBranding, logos) are handled by the Pro branding package.
 */
function generateCssTheme(config, options = {}) {
    const selector = options.selector ?? ':root';
    const includeFontImports = options.includeFontImports ?? true;
    const lines = [];
    // --- Font @imports ---
    if (includeFontImports) {
        const fonts = [];
        if (config.bodyFont)
            fonts.push(config.bodyFont);
        if (config.headingFont)
            fonts.push(config.headingFont);
        if (config.monoFont)
            fonts.push(config.monoFont);
        for (const font of fonts) {
            if (font.url) {
                if (font.url.endsWith('.css') || font.url.startsWith('https://fonts.')) {
                    lines.push(`@import url('${font.url}');`);
                }
                else {
                    lines.push(`/* Custom font '${font.family}' loaded via: ${font.url} */`);
                }
            }
            else {
                const googleImport = buildGoogleFontImport(font);
                if (googleImport)
                    lines.push(googleImport);
            }
        }
        if (lines.length > 0)
            lines.push('');
    }
    // --- CSS custom properties block ---
    const declarations = [];
    // Colors
    for (const [key, varName] of Object.entries(exports.COLOR_VAR_MAP)) {
        const value = config.colors[key];
        if (value !== undefined) {
            declarations.push(`  ${varName}: ${value};`);
            // Emit HSL components for Tailwind opacity modifier support
            const hsl = hexToHslComponents(value);
            if (hsl) {
                declarations.push(`  ${varName}-hsl: ${hsl};`);
            }
        }
    }
    // Fonts
    if (config.bodyFont) {
        declarations.push(fontToCssVar(exports.FONT_VAR_MAP['body'], config.bodyFont));
    }
    if (config.headingFont) {
        declarations.push(fontToCssVar(exports.FONT_VAR_MAP['heading'], config.headingFont));
    }
    else if (config.bodyFont) {
        declarations.push(fontToCssVar(exports.FONT_VAR_MAP['heading'], config.bodyFont));
    }
    if (config.monoFont) {
        declarations.push(fontToCssVar(exports.FONT_VAR_MAP['mono'], config.monoFont));
    }
    // App name as a CSS custom property
    declarations.push(`  --app-name: '${config.appName.replace(/'/g, "\\'")}';`);
    lines.push(`${selector} {`);
    lines.push(...declarations);
    lines.push('}');
    return lines.join('\n');
}
/**
 * Generate only the CSS custom property declarations (without selector wrapper).
 * Useful for injecting into inline styles or SSR style tags.
 */
function generateCssVariables(config) {
    const vars = {};
    for (const [key, varName] of Object.entries(exports.COLOR_VAR_MAP)) {
        const value = config.colors[key];
        if (value !== undefined) {
            vars[varName] = value;
        }
    }
    if (config.bodyFont) {
        vars[exports.FONT_VAR_MAP['body']] = `'${config.bodyFont.family}', sans-serif`;
    }
    if (config.headingFont) {
        vars[exports.FONT_VAR_MAP['heading']] = `'${config.headingFont.family}', sans-serif`;
    }
    else if (config.bodyFont) {
        vars[exports.FONT_VAR_MAP['heading']] = `'${config.bodyFont.family}', sans-serif`;
    }
    if (config.monoFont) {
        vars[exports.FONT_VAR_MAP['mono']] = `'${config.monoFont.family}', monospace`;
    }
    vars['--app-name'] = config.appName;
    return vars;
}
//# sourceMappingURL=css-generator.js.map