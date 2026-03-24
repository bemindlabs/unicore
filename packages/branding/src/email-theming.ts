// Email template theming for @bemindlabs/unicore-branding (pro edition)
// Generates email-compatible inline styles and CSS from a pro BrandingConfig.

import type { BrandingConfig } from './types';

/** Flat theme object suitable for use in email templates */
export interface EmailTheme {
  appName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  foregroundColor: string;
  mutedColor: string;
  borderColor: string;
  fontFamily: string;
  logoUrl?: string;
  faviconUrl?: string;
}

/**
 * Extract an email-safe theme from a pro BrandingConfig.
 * Resolves optional color fields to safe defaults so templates can always
 * reference every property without null checks.
 */
export function brandingToEmailTheme(config: BrandingConfig): EmailTheme {
  const { colors } = config;
  return {
    appName: config.appName,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    accentColor: colors.accent,
    backgroundColor: colors.background ?? '#ffffff',
    surfaceColor: colors.surface ?? '#f9fafb',
    foregroundColor: colors.foreground ?? '#111827',
    mutedColor: colors.muted ?? '#6b7280',
    borderColor: colors.border ?? '#e5e7eb',
    fontFamily: config.bodyFont?.family
      ? `'${config.bodyFont.family}', Arial, sans-serif`
      : 'Arial, Helvetica, sans-serif',
    logoUrl: config.logoUrl,
    faviconUrl: config.faviconUrl,
  };
}

/**
 * Generate a minimal CSS string suitable for embedding in HTML email `<style>` tags.
 * Uses table-safe selectors and avoids features that email clients strip.
 */
export function generateEmailCss(config: BrandingConfig): string {
  const t = brandingToEmailTheme(config);
  return [
    `/* Email theme for ${t.appName} */`,
    `.email-wrapper { background-color: ${t.backgroundColor}; font-family: ${t.fontFamily}; color: ${t.foregroundColor}; }`,
    `.email-header { background-color: ${t.primaryColor}; color: #ffffff; padding: 24px 32px; }`,
    `.email-body { background-color: ${t.surfaceColor}; padding: 32px; }`,
    `.email-footer { background-color: ${t.backgroundColor}; color: ${t.mutedColor}; border-top: 1px solid ${t.borderColor}; padding: 16px 32px; font-size: 12px; }`,
    `.email-button { display: inline-block; background-color: ${t.primaryColor}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }`,
    `.email-button-secondary { display: inline-block; background-color: ${t.secondaryColor}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; }`,
    `.email-link { color: ${t.accentColor}; text-decoration: underline; }`,
    `.email-divider { border: none; border-top: 1px solid ${t.borderColor}; margin: 24px 0; }`,
  ].join('\n');
}

/**
 * Generate a Record of inline style properties for use in React email templates
 * or any framework that accepts style objects.
 */
export function getEmailInlineStyles(config: BrandingConfig): {
  wrapper: Record<string, string>;
  header: Record<string, string>;
  body: Record<string, string>;
  footer: Record<string, string>;
  button: Record<string, string>;
} {
  const t = brandingToEmailTheme(config);
  return {
    wrapper: {
      backgroundColor: t.backgroundColor,
      fontFamily: t.fontFamily,
      color: t.foregroundColor,
    },
    header: {
      backgroundColor: t.primaryColor,
      color: '#ffffff',
      padding: '24px 32px',
    },
    body: {
      backgroundColor: t.surfaceColor,
      padding: '32px',
    },
    footer: {
      backgroundColor: t.backgroundColor,
      color: t.mutedColor,
      borderTop: `1px solid ${t.borderColor}`,
      padding: '16px 32px',
      fontSize: '12px',
    },
    button: {
      display: 'inline-block',
      backgroundColor: t.primaryColor,
      color: '#ffffff',
      padding: '12px 24px',
      borderRadius: '6px',
      textDecoration: 'none',
      fontWeight: '600',
    },
  };
}
