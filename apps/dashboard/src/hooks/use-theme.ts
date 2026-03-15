'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [characterTheme, setCharacterThemeState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const preferred =
      stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(preferred);
    document.documentElement.classList.toggle('dark', preferred === 'dark');

    const storedCharacter = localStorage.getItem('character-theme');
    if (storedCharacter) {
      setCharacterThemeState(storedCharacter);
      document.documentElement.setAttribute('data-character-theme', storedCharacter);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

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

  return { theme, toggleTheme, characterTheme, setCharacterTheme };
}
