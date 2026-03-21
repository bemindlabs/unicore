export interface BrandingConfig {
  appName?: string;
  faviconUrl?: string;
  logoUrl?: string;
  removeUnicoreBranding?: boolean;
  colors?: Record<string, string>;
  fonts?: Record<string, string>;
  customCss?: string;
}

export function generateCssTheme(config: BrandingConfig): string;
