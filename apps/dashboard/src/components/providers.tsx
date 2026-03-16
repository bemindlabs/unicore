'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@unicore/ui';
import { AuthProvider } from '@/components/auth/auth-provider';
import { BrandingProvider } from '@/components/BrandingProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BrandingProvider>
        {children}
      </BrandingProvider>
      <Toaster />
    </AuthProvider>
  );
}
