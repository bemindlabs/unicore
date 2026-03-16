'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { RetroDeskThemeProvider } from '@/components/backoffice/retrodesk/RetroDeskThemeProvider';
import { ChatBox } from '@/components/backoffice/chat/ChatBox';
import '@unicore/ui/globals.css';
import '@/styles/retrodesk-theme.css';

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { characterTheme } = useTheme();
  const router = useRouter();
  const isRetroDesk = characterTheme === 'retrodesk';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isRetroDesk ? '' : 'bg-[#060a14]'}`} style={isRetroDesk ? { background: 'var(--retrodesk-bg, #faf8f5)' } : undefined}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <RetroDeskThemeProvider>
      <div className={`min-h-screen ${isRetroDesk ? 'retrodesk-body' : 'bg-[#060a14] text-white'}`} style={isRetroDesk ? { background: 'var(--retrodesk-bg, #faf8f5)', color: 'var(--retrodesk-text, #2d2d2d)' } : undefined}>
        {children}
        <ChatBox />
      </div>
    </RetroDeskThemeProvider>
  );
}
