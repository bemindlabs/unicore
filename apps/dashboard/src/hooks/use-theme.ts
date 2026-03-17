'use client';

import { useCallback, useEffect, useState } from 'react';
import { resolveTheme } from '@/lib/backoffice/theme-registry';

type Theme = 'light' | 'dark';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Derive the effective ThemeOption ID from legacy localStorage keys (backward compat). */
function legacyThemeId(): string {
  const character = localStorage.getItem('character-theme');
  if (character) return character; // e.g. 'retrodesk'
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored) return stored; // 'light' | 'dark'
  return 'default';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [characterTheme, setCharacterThemeState] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('default');

  useEffect(() => {
    // Restore the selected theme, with backward compat for pre-UNC-113 localStorage keys
    const savedId = localStorage.getItem('selected-theme') ?? legacyThemeId();
    const { characterTheme: ct, colorScheme } = resolveTheme(savedId);

    const effectiveDark =
      colorScheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : colorScheme === 'dark';

    const effectiveTheme: Theme = effectiveDark ? 'dark' : 'light';

    setTheme(effectiveTheme);
    setCharacterThemeState(ct);
    setSelectedThemeId(savedId);

    document.documentElement.classList.toggle('dark', effectiveDark);
    if (ct) {
      document.documentElement.setAttribute('data-character-theme', ct);
    } else {
      document.documentElement.removeAttribute('data-character-theme');
    }
  }, []);

  /** Legacy toggle (light ↔ dark) used by non-backoffice pages. */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  /** Legacy setter for character theme — kept for external callers. */
  const setCharacterTheme = useCallback((id: string | null) => {
    setCharacterThemeState(id);
    if (id) {
      localStorage.setItem('character-theme', id);
      document.documentElement.setAttribute('data-character-theme', id);
    } else {
      localStorage.removeItem('character-theme');
      document.documentElement.removeAttribute('data-character-theme');
    }
  }, []);

  /**
   * Unified theme setter. Applies characterTheme + color scheme together,
   * persists to localStorage and user settings API.
   */
  const setThemeById = useCallback((id: string) => {
    const { characterTheme: ct, colorScheme } = resolveTheme(id);

    const effectiveDark =
      colorScheme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : colorScheme === 'dark';

    const effectiveTheme: Theme = effectiveDark ? 'dark' : 'light';

    // Update state
    setTheme(effectiveTheme);
    setCharacterThemeState(ct);
    setSelectedThemeId(id);

    // Apply to DOM
    document.documentElement.classList.toggle('dark', effectiveDark);
    if (ct) {
      document.documentElement.setAttribute('data-character-theme', ct);
    } else {
      document.documentElement.removeAttribute('data-character-theme');
    }

    // Persist to localStorage
    localStorage.setItem('selected-theme', id);
    if (colorScheme !== 'system') {
      localStorage.setItem('theme', effectiveTheme);
    } else {
      localStorage.removeItem('theme');
    }
    if (ct) {
      localStorage.setItem('character-theme', ct);
    } else {
      localStorage.removeItem('character-theme');
    }

    // Persist to user settings API (fire-and-forget)
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(`${API_BASE}/api/v1/settings/ui-theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ themeId: id }),
      }).catch(() => {/* silent — localStorage is the source of truth */});
    }

    // Reload to fully apply theme (RetroDesk ↔ Default use different layouts)
    window.location.reload();
  }, []);

  return { theme, toggleTheme, characterTheme, setCharacterTheme, selectedThemeId, setThemeById };
}
