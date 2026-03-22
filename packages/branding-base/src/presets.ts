// Default theme presets for @unicore/branding (community edition)

import type { BrandingConfig, BrandingPreset } from './types';

export const DEFAULT_PRESET_ID = 'unicore-default';

export const BRANDING_PRESETS: readonly BrandingPreset[] = [
  {
    id: 'unicore-default',
    name: 'UniCore Default',
    description: 'The standard UniCore indigo / emerald palette.',
    config: {
      colors: {
        primary: '#6366f1',    // indigo-500
        secondary: '#10b981',  // emerald-500
        accent: '#f59e0b',     // amber-500
        background: '#0f172a', // slate-900
        surface: '#1e293b',    // slate-800
        onPrimary: '#ffffff',
        foreground: '#f1f5f9', // slate-100
        muted: '#94a3b8',      // slate-400
        border: '#334155',     // slate-700
        destructive: '#ef4444',
      },
    },
  },
  {
    id: 'slate-light',
    name: 'Slate Light',
    description: 'Clean, light mode palette for modern SaaS products.',
    config: {
      colors: {
        primary: '#6366f1',    // indigo-500
        secondary: '#0ea5e9',  // sky-500
        accent: '#f59e0b',     // amber-500
        background: '#f8fafc', // slate-50
        surface: '#ffffff',
        onPrimary: '#ffffff',
        foreground: '#0f172a', // slate-900
        muted: '#64748b',      // slate-500
        border: '#e2e8f0',     // slate-200
        destructive: '#ef4444',
      },
    },
  },
] as const;

/**
 * Look up a preset by ID. Returns undefined if not found.
 */
export function findPreset(id: string): BrandingPreset | undefined {
  return BRANDING_PRESETS.find((p) => p.id === id);
}

/**
 * Return the default UniCore preset config merged with the given appName.
 */
export function getDefaultConfig(appName = 'UniCore'): BrandingConfig {
  const preset = findPreset(DEFAULT_PRESET_ID)!;
  return {
    appName,
    colors: { ...preset.config.colors },
    updatedAt: new Date().toISOString(),
  };
}
