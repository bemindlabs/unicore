'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, PanelLeftClose, PanelLeftOpen, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Button, cn, Separator } from '@unicore/ui';
import { useAuth } from '@/hooks/use-auth';
import { useLicense } from '@/hooks/use-license';
import { filterSectionsByRole } from '@/lib/navigation';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const sections = user ? filterSectionsByRole(user.role) : [];

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ?? '?';

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen border-r bg-card/50 backdrop-blur-sm transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-14 items-center gap-2 px-4 shrink-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          U
        </div>
        {!collapsed && (
          <span className="text-base font-semibold tracking-tight">UniCore</span>
        )}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="shrink-0" />

      {/* Navigation sections — scrollable */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {sections.map((section, idx) => (
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
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');
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

      <Separator className="shrink-0" />

      {/* User profile footer */}
      <div className={cn('p-2 shrink-0', collapsed ? 'flex flex-col items-center gap-1' : 'px-3 py-3')}>
        {collapsed ? (
          <>
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatarUrl} alt={user?.name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={logout} title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.avatarUrl} alt={user?.name} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={logout} title="Sign out">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
