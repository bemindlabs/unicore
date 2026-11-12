'use client';

import type { ReactNode } from 'react';
import { Toaster } from '@bemindlabs/unicore-ui';
import { AuthProvider } from '@/components/auth/auth-provider';
import { BrandingProvider } from '@/components/BrandingProvider';
import { LicenseProvider } from '@/contexts/license-context';
import { SaasProvider } from '@/contexts/saas-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SaasProvider>
        <LicenseProvider>
          <BrandingProvider>
            {children}
          </BrandingProvider>
        </LicenseProvider>
      </SaasProvider>
      <Toaster />
    </AuthProvider>
  );
}
