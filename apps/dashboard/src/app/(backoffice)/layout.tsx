'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { ChinjanThemeProvider } from '@/components/backoffice/chinjan/ChinjanThemeProvider';
import '@unicore/ui/globals.css';
import '@/styles/chinjan-theme.css';

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { characterTheme } = useTheme();
  const router = useRouter();
  const isChinjan = characterTheme === 'chinjan';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isChinjan ? '' : 'bg-[#060a14]'}`} style={isChinjan ? { background: 'var(--chinjan-bg, #faf8f5)' } : undefined}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ChinjanThemeProvider>
      <div className={`min-h-screen ${isChinjan ? 'chinjan-body' : 'bg-[#060a14] text-white'}`} style={isChinjan ? { background: 'var(--chinjan-bg, #faf8f5)', color: 'var(--chinjan-text, #2d2d2d)' } : undefined}>
        {children}
      </div>
    </ChinjanThemeProvider>
  );
}
