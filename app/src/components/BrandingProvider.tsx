'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import type { BrandingConfig } from '@bemindlabs/unicore-branding-base';
import { generateCssTheme } from '@bemindlabs/unicore-branding-base';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface BrandingContextValue {
  config: BrandingConfig | null;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);
BrandingContext.displayName = 'BrandingContext';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<BrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applyConfig = useCallback((cfg: BrandingConfig) => {
    if (typeof document === 'undefined') return;

    // --- CSS theme (colors, fonts, custom CSS) ---
    let styleEl = document.getElementById('branding-overrides') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'branding-overrides';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = generateCssTheme(cfg);

    // --- Favicon ---
    if (cfg.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.faviconUrl;
    }

    // --- Document title ---
    if (cfg.appName) {
      document.title = cfg.appName;
    }

    // --- White-label attribute ---
    if (cfg.removeUnicoreBranding) {
      document.documentElement.setAttribute('data-white-label', '1');
    } else {
      document.documentElement.removeAttribute('data-white-label');
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await api.get<BrandingConfig>('/api/v1/settings/branding');
      setConfig(cfg);
      applyConfig(cfg);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return (
    <BrandingContext.Provider value={{ config, loading, error, reload: fetchConfig }}>
      {children}
    </BrandingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used inside a <BrandingProvider>');
  return ctx;
}
