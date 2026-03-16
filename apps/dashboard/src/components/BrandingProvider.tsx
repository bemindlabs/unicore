'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface BrandingConfig {
  presetId?: string;
  colors?: Record<string, string>;
  appName?: string;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    api.get<BrandingConfig>('/api/v1/settings/branding')
      .then(setConfig)
      .catch(() => {}); // No branding = use defaults
  }, []);

  // If custom colors exist, inject CSS variables
  useEffect(() => {
    if (!config?.colors) return;
    const style = document.createElement('style');
    style.id = 'branding-overrides';
    const vars = Object.entries(config.colors)
      .map(([key, val]) => `--${key}: ${val};`)
      .join('\n  ');
    style.textContent = `:root {\n  ${vars}\n}`;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [config]);

  return <>{children}</>;
}
