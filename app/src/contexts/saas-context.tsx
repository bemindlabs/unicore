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
 * Single source of truth for the three run-mode signals the UI branches on:
 *  - `deploymentMode`  — self-host (open-core, single tenant) vs saas (Bemind-hosted).
 *    Read from the build-time `NEXT_PUBLIC_DEPLOYMENT_MODE` flag (defaults to
 *    `self-host`, mirroring the backend `DEPLOYMENT_MODE` default in `.env.example`).
 *  - `isSuperAdmin`    — whether the current user may operate the cross-tenant
 *    control plane. The backend `SuperAdminGuard` reads `User.isSuperAdmin` live
 *    from the DB and remains the authoritative gate on every control-plane
 *    request; the dashboard only needs the flag to decide what UI to render, so
 *    we read it from the `/auth/me` payload (FU-01) rather than probing the
 *    guarded `/admin/overview` endpoint. In self-host the control-plane surfaces
 *    stay hidden anyway (there is only one tenant) — so super-admin is reported
 *    false in self-host.
 *  - `subscription`    — the trial / subscription view from
 *    `GET /api/v1/tenant/subscription`, consumed by the trial banner.
 *
 * Self-host keeps the open-core experience clean: trial banner, signup, and the
 * Bemind-admin surfaces are all hidden/no-ops.
 */

export type DeploymentMode = 'self-host' | 'saas';

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
  deploymentMode: DeploymentMode;
  isSaas: boolean;
  isSuperAdmin: boolean;
  subscription: SubscriptionView | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

function resolveMode(): DeploymentMode {
  const raw = (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE ?? '').toLowerCase();
  // Honor the legacy TENANCY=multi alias used on the backend.
  if (raw === 'saas' || raw === 'multi') return 'saas';
  return 'self-host';
}

const DEPLOYMENT_MODE = resolveMode();

export const SaasContext = createContext<SaasContextValue | null>(null);

export function SaasProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const isSaas = DEPLOYMENT_MODE === 'saas';

  // Super-admin is derived from the `/auth/me` payload (FU-01) — no guard probe.
  // The backend SuperAdminGuard still enforces every control-plane request; this
  // flag only drives which UI surfaces render. Self-host keeps it hidden anyway.
  const isSuperAdmin = isSaas ? Boolean(user?.isSuperAdmin) : false;

  const refresh = useCallback(async () => {
    // Self-host: no control plane, no trial — keep everything quiet.
    if (!isSaas || !isAuthenticated) {
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
  }, [isSaas, isAuthenticated]);

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
        deploymentMode: DEPLOYMENT_MODE,
        isSaas,
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
