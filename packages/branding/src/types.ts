// @bemindlabs/unicore-branding — Pro branding types (extends community edition)

// Re-export all community base types
export type {
  FontWeight,
  BrandingFont,
  BrandingColors,
  CssGeneratorOptions as BaseCssGeneratorOptions,
} from '@bemindlabs/unicore-branding-base/types';

import type { BrandingConfig as BaseBrandingConfig, BrandingColors } from '@bemindlabs/unicore-branding-base/types';

/**
 * Pro branding configuration — extends the community base with white-label
 * and advanced customization features.
 */
export interface BrandingConfig extends BaseBrandingConfig {
  /** URL to the main logo image (SVG or PNG recommended). */
  logoUrl?: string;
  /** URL to a compact / icon-only logo for sidebar collapsed state. */
  logoIconUrl?: string;
  /** URL to the favicon (ICO, PNG, or SVG). */
  faviconUrl?: string;
  /**
   * When true, all UniCore-specific branding (name, logo, "Powered by" footer)
   * is removed from the UI. Requires whiteLabelBranding license feature.
   */
  removeUnicoreBranding: boolean;
  /** Custom CSS to inject after generated theme variables. */
  customCss?: string;
}

/** Minimal override shape for partial updates to pro branding config */
export type BrandingConfigPatch = Partial<Omit<BrandingConfig, 'colors'>> & {
  colors?: Partial<BrandingColors>;
};

/** Configuration for character theme decorations */
export interface CharacterThemeConfig {
  /** Unique ID of the character theme */
  id: string;
  /** Whether character decorations are enabled */
  enabled: boolean;
  /** Animation level: 'none' | 'minimal' | 'full' */
  animationLevel: 'none' | 'minimal' | 'full';
}

/** A named preset theme (pro edition — may include character theme config) */
export interface BrandingPreset {
  id: string;
  name: string;
  description?: string;
  config: Omit<BrandingConfig, 'appName' | 'removeUnicoreBranding' | 'updatedAt'> & {
    characterTheme?: CharacterThemeConfig;
  };
}

/** Options for pro CSS theme generation */
export interface CssGeneratorOptions {
  /** CSS selector to scope variables under. Defaults to ":root" */
  selector?: string;
  /** Whether to emit @font-face / @import rules for custom fonts. Defaults to true */
  includeFontImports?: boolean;
  /** Whether to append customCss at the end. Defaults to true */
  includeCustomCss?: boolean;
}
