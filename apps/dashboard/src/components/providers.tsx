'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@unicore/ui';
import { AuthProvider } from '@/components/auth/auth-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  );
}
