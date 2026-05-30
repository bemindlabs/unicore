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
 *    control plane. The backend `SuperAdminGuard` is the source of truth (it reads
 *    `User.isSuperAdmin` live from the DB and is never surfaced on the JWT/`/auth/me`),
 *    so we *probe* the guarded admin endpoint rather than trust a client claim:
 *    200 ⇒ super-admin, 403 ⇒ tenant owner. In self-host the guard passes through
 *    unconditionally, but the control-plane surfaces stay hidden anyway (there is
 *    only one tenant) — so super-admin is reported false in self-host.
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
  const { isAuthenticated } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const isSaas = DEPLOYMENT_MODE === 'saas';

  const refresh = useCallback(async () => {
    // Self-host: no control plane, no trial — keep everything quiet.
    if (!isSaas || !isAuthenticated) {
      if (isMounted.current) {
        setIsSuperAdmin(false);
        setSubscription(null);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    // Trial / subscription view for the banner.
    const subPromise = api
      .get<SubscriptionView>('/api/v1/tenant/subscription')
      .catch(() => null);

    // Super-admin probe: the control-plane overview is behind SuperAdminGuard.
    // A resolved promise (200) means the user cleared the guard; a thrown 403
    // means they are a tenant owner. We never trust a client-held flag.
    const adminProbe = api
      .get('/api/v1/admin/overview')
      .then(() => true)
      .catch(() => false);

    const [sub, admin] = await Promise.all([subPromise, adminProbe]);

    if (isMounted.current) {
      setSubscription(sub);
      setIsSuperAdmin(admin);
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
