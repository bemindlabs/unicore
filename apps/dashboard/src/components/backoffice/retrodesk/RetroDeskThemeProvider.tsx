'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useTheme } from '@/hooks/use-theme';

interface RetroDeskThemeContext {
  isActive: boolean;
  animationLevel: 'none' | 'minimal' | 'full';
}

const RetroDeskCtx = createContext<RetroDeskThemeContext>({ isActive: false, animationLevel: 'full' });

export function RetroDeskThemeProvider({ children, forceTheme }: { children: ReactNode; forceTheme?: string }) {
  const { characterTheme } = useTheme();
  const isActive = forceTheme === 'retrodesk' || characterTheme === 'retrodesk';
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    function onChange(e: MediaQueryListEvent) { setReducedMotion(e.matches); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <RetroDeskCtx.Provider value={{ isActive, animationLevel: reducedMotion ? 'none' : 'full' }}>
      {children}
    </RetroDeskCtx.Provider>
  );
}

export function useRetroDeskTheme() {
  return useContext(RetroDeskCtx);
}

export function RetroDeskOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isActive } = useRetroDeskTheme();
  if (!isActive) return fallback ?? null;
  return <>{children}</>;
}

export function DefaultOnly({ children }: { children: ReactNode }) {
  const { isActive } = useRetroDeskTheme();
  if (isActive) return null;
  return <>{children}</>;
}
