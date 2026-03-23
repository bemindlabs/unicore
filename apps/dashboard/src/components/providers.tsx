'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@unicore/ui';
import { AuthProvider } from '@/components/auth/auth-provider';
import { BrandingProvider } from '@/components/BrandingProvider';
import { LicenseProvider } from '@/contexts/license-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LicenseProvider>
        <BrandingProvider>
          {children}
        </BrandingProvider>
      </LicenseProvider>
      <Toaster />
    </AuthProvider>
  );
}
