'use client';

import type { ReactNode } from 'react';
import { useSaas } from '@/contexts/saas-context';

/**
 * Bemind super-admin control plane gate (M4/E5).
 *
 * Access is governed by the live `isSuperAdmin` signal, which is derived by
 * probing the backend `SuperAdminGuard` (see SaasContext) — the authoritative
 * source. A tenant OWNER who is not a platform super-admin is blocked; in
 * self-host (single-tenant, open-core) the whole control plane stays hidden.
 */
export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { isSaas, isSuperAdmin, loading } = useSaas();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Self-host has no cross-tenant control plane; super-admins only in SaaS.
  if (!isSaas || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">
          You do not have permission to access this area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
