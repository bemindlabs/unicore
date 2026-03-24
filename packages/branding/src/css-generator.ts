// CSS theme generator for @bemindlabs/unicore-branding (pro edition)
// Extends community base with: removeUnicoreBranding, customCss injection

import {
  COLOR_VAR_MAP,
  FONT_VAR_MAP,
  hexToHslComponents,
  buildGoogleFontImport,
  generateCssVariables as generateBaseCssVariables,
} from '@bemindlabs/unicore-branding-base/css-generator';
import type { BrandingFont } from '@bemindlabs/unicore-branding-base/types';
import type { BrandingConfig, CssGeneratorOptions } from './types';

function fontToCssVar(varName: string, font: BrandingFont): string {
  return `  ${varName}: '${font.family}', sans-serif;`;
}

/**
 * Generate the complete CSS theme string from a pro BrandingConfig.
 * Handles all community features (colors, fonts, app-name) plus pro features:
 * - removeUnicoreBranding flag and [data-unicore-branding] hide rule
 * - customCss injection
 */
export function generateCssTheme(
  config: BrandingConfig,
  options: CssGeneratorOptions = {},
): string {
  const selector = options.selector ?? ':root';
  const includeFontImports = options.includeFontImports ?? true;
  const includeCustomCss = options.includeCustomCss ?? true;

  const lines: string[] = [];

  // --- Font @imports ---
  if (includeFontImports) {
    const fonts: BrandingFont[] = [];
    if (config.bodyFont) fonts.push(config.bodyFont);
    if (config.headingFont) fonts.push(config.headingFont);
    if (config.monoFont) fonts.push(config.monoFont);

    for (const font of fonts) {
      if (font.url) {
        if (font.url.endsWith('.css') || font.url.startsWith('https://fonts.')) {
          lines.push(`@import url('${font.url}');`);
        } else {
          lines.push(`/* Custom font '${font.family}' loaded via: ${font.url} */`);
        }
      } else {
        const googleImport = buildGoogleFontImport(font);
        if (googleImport) lines.push(googleImport);
      }
    }
    if (lines.length > 0) lines.push('');
  }

  // --- CSS custom properties block ---
  const declarations: string[] = [];

  // Colors (with HSL companions for Tailwind opacity modifier support)
  for (const [key, varName] of Object.entries(COLOR_VAR_MAP)) {
    const value = (config.colors as unknown as Record<string, string | undefined>)[key];
    if (value !== undefined) {
      declarations.push(`  ${varName}: ${value};`);
      const hsl = hexToHslComponents(value);
      if (hsl) {
        declarations.push(`  ${varName}-hsl: ${hsl};`);
      }
    }
  }

  // Fonts
  if (config.bodyFont) {
    declarations.push(fontToCssVar(FONT_VAR_MAP['body']!, config.bodyFont));
  }
  if (config.headingFont) {
    declarations.push(fontToCssVar(FONT_VAR_MAP['heading']!, config.headingFont));
  } else if (config.bodyFont) {
    declarations.push(fontToCssVar(FONT_VAR_MAP['heading']!, config.bodyFont));
  }
  if (config.monoFont) {
    declarations.push(fontToCssVar(FONT_VAR_MAP['mono']!, config.monoFont));
  }

  // App name CSS custom property
  declarations.push(`  --app-name: '${config.appName.replace(/'/g, "\\'")}';`);

  // Pro: white-label flag
  declarations.push(
    `  --remove-unicore-branding: ${config.removeUnicoreBranding ? '1' : '0'};`,
  );

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
export function generateCssVariables(config: BrandingConfig): Record<string, string> {
  // Start with community base vars (colors, fonts, app-name)
  const vars = generateBaseCssVariables(config);

  // Pro: add white-label flag
  vars['--remove-unicore-branding'] = config.removeUnicoreBranding ? '1' : '0';

  return vars;
}
