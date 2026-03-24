export interface ThemeOption {
  /** Internal identifier. 'default' maps to system preference, 'dark'/'light' force that mode. */
  id: string;
  /** Human-readable display name */
  label: string;
  /** Emoji shown in the selector */
  icon: string;
  /** Short description shown under the label */
  description: string;
}

export interface ResolvedTheme {
  /** Character/skin theme (null = default cyberpunk). */
  characterTheme: string | null;
  /** Color scheme to apply. 'system' means follow OS preference. */
  colorScheme: 'light' | 'dark' | 'system';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'default', label: 'Default', icon: '\u{1F5A5}', description: 'Follows system preference' },
  { id: 'dark', label: 'Dark', icon: '\u{1F319}', description: 'Dark cyberpunk mode' },
  { id: 'light', label: 'Light', icon: '\u2600\uFE0F', description: 'Light mode' },
  { id: 'retrodesk', label: 'RetroDesk', icon: '\u{1F47E}', description: 'Chinjan \u00B7 Pixel art office' },
  { id: 'crypto', label: 'Crypto', icon: '\u{1F680}', description: 'Meme coin agents \u00B7 To the moon' },
];

// ---------------------------------------------------------------------------
// Character Skins — sub-themes for RetroDesk / Crypto
// ---------------------------------------------------------------------------
export interface CharacterSkin {
  id: string;
  label: string;
  icon: string;
  /** The data-character-theme attribute value, e.g. "retrodesk-pepe" */
  themeValue: string;
}

export const CHARACTER_SKINS: CharacterSkin[] = [
  { id: 'pepe', label: 'Pepe', icon: '\u{1F438}', themeValue: 'retrodesk-pepe' },
  { id: 'doge', label: 'Doge', icon: '\u{1F436}', themeValue: 'retrodesk-doge' },
  { id: 'shib', label: 'Shiba', icon: '\u{1F415}', themeValue: 'retrodesk-shib' },
  { id: 'bonk', label: 'Bonk', icon: '\u{1F528}', themeValue: 'retrodesk-bonk' },
  { id: 'floki', label: 'Floki', icon: '\u2693', themeValue: 'retrodesk-floki' },
];

/**
 * Check if a character theme value is a RetroDesk-family theme
 * (retrodesk, crypto, or any retrodesk-* skin variant).
 */
export function isRetroDeskFamily(characterTheme: string | null): boolean {
  if (!characterTheme) return false;
  return characterTheme === 'retrodesk' || characterTheme === 'crypto' || characterTheme.startsWith('retrodesk-');
}

/**
 * Get the active skin ID from a characterTheme value, or null if no skin is active.
 */
export function getActiveSkinId(characterTheme: string | null): string | null {
  if (!characterTheme) return null;
  const skin = CHARACTER_SKINS.find((s) => s.themeValue === characterTheme);
  return skin?.id ?? null;
}

/**
 * Resolve a theme ID to its characterTheme + colorScheme.
 */
export function resolveTheme(id: string): ResolvedTheme {
  switch (id) {
    case 'retrodesk': return { characterTheme: 'retrodesk', colorScheme: 'dark' };
    case 'crypto':    return { characterTheme: 'crypto', colorScheme: 'dark' };
    case 'light':     return { characterTheme: null, colorScheme: 'light' };
    case 'dark':      return { characterTheme: null, colorScheme: 'dark' };
    default:          return { characterTheme: null, colorScheme: 'system' };
  }
}

/**
 * Derive the theme-registry id from stored state.
 * Falls back to 'default' when nothing is stored.
 */
export function toThemeId(characterTheme: string | null, colorScheme?: 'light' | 'dark'): string {
  if (characterTheme) return characterTheme;
  if (colorScheme) return colorScheme;
  return 'default';
}

/**
 * Legacy compat: resolve a theme id to the characterTheme value (null | string).
 */
export function resolveThemeId(id: string): string | null {
  return resolveTheme(id).characterTheme;
}
