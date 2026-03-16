export interface ThemeOption {
  /** Internal identifier. 'default' maps to null character-theme (dark cyberpunk). */
  id: string;
  /** Human-readable display name */
  label: string;
  /** Emoji shown in the selector */
  icon: string;
  /** Short description shown under the label */
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'default', label: 'Default', icon: '\u{1F319}', description: 'Dark cyberpunk theme' },
  { id: 'retrodesk', label: 'RetroDesk', icon: '\u{1F47E}', description: 'Pixel art office' },
];

/**
 * Resolve a theme id to the value stored in localStorage / data-attribute.
 * 'default' maps to `null` (no character-theme attribute).
 */
export function resolveThemeId(id: string): string | null {
  return id === 'default' ? null : id;
}

/**
 * Derive the theme-registry id from the raw character-theme value.
 */
export function toThemeId(characterTheme: string | null): string {
  return characterTheme ?? 'default';
}
