'use client';

import { useAuth } from '@/hooks/use-auth';
import { isDemoMode } from '@/lib/demo';

/**
 * Returns true when the dashboard is running in demo mode.
 * Use this hook in any component that needs to conditionally hide
 * destructive actions (e.g. delete buttons) or restricted pages.
 */
export function useDemoMode(): boolean {
  const { user } = useAuth();
  return isDemoMode(user?.email);
}
