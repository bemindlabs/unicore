'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

/**
 * One business the current user belongs to (GET /tenants). Mirrors the
 * gateway `MembershipView` (Phase 5 / W1a — multi-business memberships).
 */
export interface Membership {
  tenantId: string;
  name: string;
  plan: string;
  role: string;
  /** True for the user's currently-active tenant. */
  isActive: boolean;
}

/** Token + user payload re-issued by POST /tenants/switch (AuthResponseDto). */
interface SwitchResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; name: string; role: string };
}

interface UseTenantsResult {
  tenants: Membership[];
  active: Membership | null;
  loading: boolean;
  /** True while a switch/create request is in flight. */
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /**
   * Switch the active business → store the new token → hard-reload into it.
   * `redirectTo` controls the landing path (defaults to '/'); the
   * "create new business" flow points it at the onboarding wizard.
   */
  switchTo: (tenantId: string, redirectTo?: string) => Promise<void>;
  /** Create a new business (caller becomes OWNER) → returns the new tenantId. */
  create: (name: string) => Promise<string>;
}

/**
 * Loads the current user's businesses and drives the workspace switcher.
 *
 * Switching re-issues an access token whose `tid` claim is the new active
 * tenant; we persist it (mirroring AuthProvider's token handling) and do a hard
 * reload so every provider/query re-resolves against the now-active business.
 */
export function useTenants(): UseTenantsResult {
  const { isAuthenticated } = useAuth();
  const [tenants, setTenants] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setTenants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.get<Membership[]>('/tenants');
      setTenants(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchTo = useCallback(
    async (tenantId: string, redirectTo = '/') => {
      setBusy(true);
      try {
        const res = await api.post<SwitchResponse>('/tenants/switch', { tenantId });
        localStorage.setItem('auth_token', res.accessToken);
        localStorage.setItem('refresh_token', res.refreshToken);
        document.cookie = `auth_token=${res.accessToken}; path=/; SameSite=Lax`;
        // Hard reload into the now-active business so all data re-resolves.
        window.location.assign(redirectTo);
      } catch (err) {
        setBusy(false);
        setError((err as Error).message);
        throw err;
      }
    },
    [],
  );

  const create = useCallback(async (name: string) => {
    setBusy(true);
    try {
      const created = await api.post<Membership>('/tenants', { name });
      setError(null);
      return created.tenantId;
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const active = tenants.find((t) => t.isActive) ?? null;

  return { tenants, active, loading, busy, error, refresh, switchTo, create };
}
