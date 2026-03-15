'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useTheme } from '@/hooks/use-theme';

interface ChinjanThemeContext {
  isActive: boolean;
  animationLevel: 'none' | 'minimal' | 'full';
}

const ChinjanCtx = createContext<ChinjanThemeContext>({ isActive: false, animationLevel: 'full' });

export function ChinjanThemeProvider({ children }: { children: ReactNode }) {
  const { characterTheme } = useTheme();
  const isActive = characterTheme === 'chinjan';
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    function onChange(e: MediaQueryListEvent) { setReducedMotion(e.matches); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <ChinjanCtx.Provider value={{ isActive, animationLevel: reducedMotion ? 'none' : 'full' }}>
      {children}
    </ChinjanCtx.Provider>
  );
}

export function useChinjanTheme() {
  return useContext(ChinjanCtx);
}

export function ChinjanOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isActive } = useChinjanTheme();
  if (!isActive) return fallback ?? null;
  return <>{children}</>;
}

export function DefaultOnly({ children }: { children: ReactNode }) {
  const { isActive } = useChinjanTheme();
  if (isActive) return null;
  return <>{children}</>;
}
