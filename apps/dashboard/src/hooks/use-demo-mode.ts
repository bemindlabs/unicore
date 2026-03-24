'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { isDemoMode } from '@/lib/demo';
import { api } from '@/lib/api';

/**
 * Returns true when the dashboard is running in demo mode.
 * Checks both client-side flags (NEXT_PUBLIC_EDITION, email)
 * and the backend DEMO_MODE env var via /api/v1/settings/demo-status.
 */
export function useDemoMode(): boolean {
  const { user } = useAuth();
  const [serverDemoMode, setServerDemoMode] = useState(false);

  useEffect(() => {
    api
      .get<{ demoMode: boolean }>('/api/v1/settings/demo-status')
      .then((res) => setServerDemoMode(res.demoMode ?? false))
      .catch(() => {});
  }, []);

  return isDemoMode(user?.email) || serverDemoMode;
}
