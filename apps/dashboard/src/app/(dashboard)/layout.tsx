'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { useSidebar } from '@/hooks/use-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { DeployButton } from '@/components/demo/DeployButton';
import { UpgradeBanner } from '@/components/license/upgrade-banner';
import { RetroDeskThemeProvider } from '@/components/backoffice/retrodesk/RetroDeskThemeProvider';
import { isRetroDeskFamily } from '@/lib/backoffice/theme-registry';
import '@/styles/retrodesk-theme.css';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { characterTheme } = useTheme();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const demoMode = useDemoMode();
  const isRetroDesk = isRetroDeskFamily(characterTheme);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
            U
          </div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const bgClass = isRetroDesk
    ? 'retrodesk-body'
    : 'bg-muted/30';
  const bgStyle = isRetroDesk
    ? { background: 'var(--retrodesk-bg, #faf8f5)', color: 'var(--retrodesk-text, #2d2d2d)' }
    : undefined;

  return (
    <RetroDeskThemeProvider>
      {demoMode && <DemoBanner />}
      <div
        className={`flex h-screen overflow-hidden ${bgClass}${demoMode ? ' pt-9' : ''}`}
        style={bgStyle}
      >
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header onMobileMenuToggle={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="w-full p-4 lg:p-6">{children}</div>
          </main>
        </div>
      </div>
      {demoMode && <DeployButton />}
    </RetroDeskThemeProvider>
  );
}
