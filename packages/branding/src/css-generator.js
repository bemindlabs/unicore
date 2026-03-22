"use strict";
// CSS theme generator for @unicore/branding (pro edition)
// Extends community base with: removeUnicoreBranding, customCss injection
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCssTheme = generateCssTheme;
exports.generateCssVariables = generateCssVariables;
const css_generator_1 = require("@unicore/branding-base/css-generator");
function fontToCssVar(varName, font) {
    return `  ${varName}: '${font.family}', sans-serif;`;
}
/**
 * Generate the complete CSS theme string from a pro BrandingConfig.
 * Handles all community features (colors, fonts, app-name) plus pro features:
 * - removeUnicoreBranding flag and [data-unicore-branding] hide rule
 * - customCss injection
 */
function generateCssTheme(config, options = {}) {
    const selector = options.selector ?? ':root';
    const includeFontImports = options.includeFontImports ?? true;
    const includeCustomCss = options.includeCustomCss ?? true;
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
                const googleImport = (0, css_generator_1.buildGoogleFontImport)(font);
                if (googleImport)
                    lines.push(googleImport);
            }
        }
        if (lines.length > 0)
            lines.push('');
    }
    // --- CSS custom properties block ---
    const declarations = [];
    // Colors (with HSL companions for Tailwind opacity modifier support)
    for (const [key, varName] of Object.entries(css_generator_1.COLOR_VAR_MAP)) {
        const value = config.colors[key];
        if (value !== undefined) {
            declarations.push(`  ${varName}: ${value};`);
            const hsl = (0, css_generator_1.hexToHslComponents)(value);
            if (hsl) {
                declarations.push(`  ${varName}-hsl: ${hsl};`);
            }
        }
    }
    // Fonts
    if (config.bodyFont) {
        declarations.push(fontToCssVar(css_generator_1.FONT_VAR_MAP['body'], config.bodyFont));
    }
    if (config.headingFont) {
        declarations.push(fontToCssVar(css_generator_1.FONT_VAR_MAP['heading'], config.headingFont));
    }
    else if (config.bodyFont) {
        declarations.push(fontToCssVar(css_generator_1.FONT_VAR_MAP['heading'], config.bodyFont));
    }
    if (config.monoFont) {
        declarations.push(fontToCssVar(css_generator_1.FONT_VAR_MAP['mono'], config.monoFont));
    }
    // App name CSS custom property
    declarations.push(`  --app-name: '${config.appName.replace(/'/g, "\\'")}';`);
    // Pro: white-label flag
    declarations.push(`  --remove-unicore-branding: ${config.removeUnicoreBranding ? '1' : '0'};`);
    lines.push(`${selector} {`);
    lines.push(...declarations);
    lines.push('}');
    // Pro: hide UniCore branding elements when flag is set
    if (config.removeUnicoreBranding) {
        lines.push('');
        lines.push('/* UniCore branding removed by white-label configuration */');
        lines.push('[data-unicore-branding] { display: none !important; }');
    }
    // Pro: custom CSS injection
    if (includeCustomCss && config.customCss) {
        lines.push('');
        lines.push('/* Custom CSS */');
        lines.push(config.customCss);
    }
    return lines.join('\n');
}
/**
 * Generate only the CSS custom property declarations (without selector wrapper).
 * Extends the community base with pro-specific variables.
 */
function generateCssVariables(config) {
    // Start with community base vars (colors, fonts, app-name)
    const vars = (0, css_generator_1.generateCssVariables)(config);
    // Pro: add white-label flag
    vars['--remove-unicore-branding'] = config.removeUnicoreBranding ? '1' : '0';
    return vars;
}
//# sourceMappingURL=css-generator.js.map