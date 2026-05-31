'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

/**
 * SaaS / tenancy signals for the dashboard (M4/E5 — control plane).
 *
 * UniCore is always multi-tenant SaaS, so these signals always apply:
 *  - `isSuperAdmin` — whether the current user may operate the cross-tenant
 *    control plane. The backend `SuperAdminGuard` reads `User.isSuperAdmin` live
 *    from the DB and remains the authoritative gate on every control-plane
 *    request; the dashboard only needs the flag to decide what UI to render, so
 *    we read it from the `/auth/me` payload (FU-01) rather than probing the
 *    guarded `/admin/overview` endpoint.
 *  - `subscription` — the trial / subscription view from
 *    `GET /api/v1/tenant/subscription`, consumed by the trial banner.
 */

export interface SubscriptionView {
  tenantId: string;
  plan: string;
  subscriptionStatus: string;
  status: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number;
  isTrialing: boolean;
  suspended: boolean;
  entitlementEdition: 'community' | 'pro';
}

interface SaasContextValue {
  isSuperAdmin: boolean;
  subscription: SubscriptionView | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export const SaasContext = createContext<SaasContextValue | null>(null);

export function SaasProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  // Super-admin is derived from the `/auth/me` payload (FU-01) — no guard probe.
  // The backend SuperAdminGuard still enforces every control-plane request; this
  // flag only drives which UI surfaces render.
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      if (isMounted.current) {
        setSubscription(null);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    // Trial / subscription view for the banner.
    const sub = await api
      .get<SubscriptionView>('/api/v1/tenant/subscription')
      .catch(() => null);

    if (isMounted.current) {
      setSubscription(sub);
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    isMounted.current = true;
    refresh();
    return () => {
      isMounted.current = false;
    };
  }, [refresh]);

  return (
    <SaasContext.Provider
      value={{
        isSuperAdmin,
        subscription,
        loading,
        refresh,
      }}
    >
      {children}
    </SaasContext.Provider>
  );
}

export function useSaas(): SaasContextValue {
  const ctx = useContext(SaasContext);
  if (!ctx) throw new Error('useSaas must be used within a SaasProvider');
  return ctx;
}
