'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Crown, ExternalLink, Lock, PanelLeftClose, PanelLeftOpen, LogOut, Monitor } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, cn, Separator } from '@bemindlabs/unicore-ui';
import { useAuth } from '@/hooks/use-auth';
import { useLicense } from '@/hooks/use-license';
import { useBranding } from '@/components/BrandingProvider';
import { filterSectionsByRole, isNavItemLocked } from '@/lib/navigation';
import { UpgradeModal } from '@/components/upgrade-modal';
import type { NavItem } from '@/types/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isPro, edition, hasFeature } = useLicense();
  const { config } = useBranding();
  const appName = config?.appName ?? 'UniCore';
  const t = useTranslations('common');
  const sections = user ? filterSectionsByRole(user.role) : [];

  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    tier: 'pro' | 'enterprise';
    featureName?: string;
  }>({ open: false, tier: 'pro' });

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ?? '?';

  function openUpgradeModal(item: NavItem) {
    setUpgradeModal({
      open: true,
      tier: item.license?.tier ?? 'pro',
      featureName: item.label,
    });
  }

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col h-screen border-r bg-card/50 backdrop-blur-sm transition-all duration-300 sticky top-0',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Brand + collapse toggle */}
        <div className="flex h-14 items-center gap-2 px-4 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold" data-unicore-branding>
            {appName[0] ?? 'U'}
          </div>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight" data-unicore-branding>{appName}</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <Separator className="shrink-0" />

        {/* Navigation sections — scrollable */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
          {sections
            .filter((section) =>
              section.items.some((item) => !isNavItemLocked(item, isPro, edition, hasFeature)),
            )
            .map((section, idx) => (
            <div key={section.label} className={cn(idx > 0 && 'mt-4')}>
              {!collapsed && (
                <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </p>
              )}
              {collapsed && idx > 0 && (
                <Separator className="mx-auto mb-2 w-8" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const locked = isNavItemLocked(item, isPro, edition, hasFeature);

                  // Hide menu items that require a higher license tier
                  if (locked) {
                    return null;
                  }

                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname === item.href || pathname.startsWith(item.href + '/');

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                          collapsed && 'justify-center px-2',
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
                          </>
                        )}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        collapsed && 'justify-center px-2',
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section — pinned, never overflows */}
        <div className="shrink-0 overflow-hidden">
          {/* Backoffice + Upgrade links */}
          <div className="px-2 pb-1 space-y-0.5">
            <Link
              href="/backoffice"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                pathname.startsWith('/backoffice')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
              title={t('backoffice')}
            >
              <Monitor className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{t('backoffice')}</span>}
            </Link>

            {!isPro && (
              <Link
                href="/settings/license"
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25',
                  collapsed && 'justify-center px-2',
                )}
                title={t('upgradeToPro')}
              >
                <Crown className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{t('upgradeToPro')}</span>}
              </Link>
            )}
          </div>

          <Separator />

          {/* User profile footer */}
          {user ? (
            <div className={cn('p-2', collapsed ? 'flex flex-col items-center gap-1' : 'px-3 py-2')}>
              {collapsed ? (
                <>
                  <Link href="/profile" title={user.name ?? 'Profile'}>
                    <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={logout}
                    title={t('signOut')}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/profile" className="shrink-0" title="Edit profile">
                    <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all">
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link href="/profile" className="min-w-0 flex-1 overflow-hidden hover:opacity-80 transition-opacity">
                    <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground leading-tight">{user.email}</p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={logout}
                    title={t('signOut')}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className={cn('p-2', collapsed ? 'flex justify-center' : 'px-3 py-2')}>
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            </div>
          )}
        </div>
      </aside>

      <UpgradeModal
        open={upgradeModal.open}
        onOpenChange={(open) => setUpgradeModal((prev) => ({ ...prev, open }))}
        requiredTier={upgradeModal.tier}
        featureName={upgradeModal.featureName}
      />
    </>
  );
}
