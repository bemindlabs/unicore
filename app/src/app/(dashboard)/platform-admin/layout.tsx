'use client';

import type { ReactNode } from 'react';
import { useRequireAuth } from '@/hooks/use-auth';

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { requireRole } = useRequireAuth();

  if (!requireRole(['owner'])) {
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
