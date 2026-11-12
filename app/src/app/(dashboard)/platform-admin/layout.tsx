'use client';

import type { ReactNode } from 'react';
import { useSaas } from '@/contexts/saas-context';

/**
 * Bemind super-admin control plane gate (M4/E5).
 *
 * Access is governed by the live `isSuperAdmin` signal (see SaasContext); the
 * backend `SuperAdminGuard` is the authoritative source. A tenant OWNER who is
 * not a platform super-admin is blocked.
 */
export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useSaas();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Control plane is restricted to platform super-admins.
  if (!isSuperAdmin) {
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
