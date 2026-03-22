// Tailwind CSS integration for @unicore/branding (pro edition)
// Re-exports community base implementation — pro BrandingConfig is structurally
// compatible with BaseBrandingConfig (it extends it), so all helpers work as-is.

export type {
  TailwindColorScale,
  TailwindThemeExtension,
  TailwindColorScale as TwColorScale,
  TailwindThemeExtension as TwThemeExtension,
} from '@unicore/branding-base/tailwind';

export {
  brandingToTailwindTheme,
  brandingToCssVarTailwindTheme,
} from '@unicore/branding-base/tailwind';
