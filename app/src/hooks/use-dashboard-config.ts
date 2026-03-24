'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DEFAULT_DASHBOARD_CONFIG } from '@/config/default-dashboard';
import type { DashboardConfig } from '@/types/widget';

/**
 * Loads the dashboard widget configuration.
 * Attempts to fetch from the API (/api/v1/config/dashboard) first;
 * falls back to the baked-in default when unavailable.
 */
export function useDashboardConfig(): {
  config: DashboardConfig;
  loading: boolean;
} {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const remote = await api.get<DashboardConfig>('/api/v1/config/dashboard');
        if (!cancelled && remote?.widgets?.length) {
          setConfig(remote);
        }
      } catch {
        // silently use default config
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading };
}
