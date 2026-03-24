'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { siteConfig } from '@/lib/site-config';
import {
  LayoutDashboard,
  MessageCircle,
  BarChart3,
  KeyRound,
  Settings,
  Zap,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const navItems = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/chat', label: 'Chat', icon: MessageCircle },
  { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/portal/api-keys', label: 'API Keys', icon: Settings },
  { href: '/portal/license', label: 'License', icon: KeyRound },
];

function Sidebar({ onClose, userName, userEmail }: { onClose?: () => void; userName: string; userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('dlc_token');
    localStorage.removeItem('dlc_refresh_token');
    localStorage.removeItem('dlc_user');
    document.cookie = 'dlc_token=; path=/; max-age=0';
    router.push('/login');
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/portal" className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold text-zinc-50">AI-DLC Portal</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active = item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={onClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50'
              }`}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {active && <ChevronRight className="ml-auto h-3 w-3" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="mb-3">
          <p className="text-sm font-medium text-zinc-50 truncate">{userName}</p>
          <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleLogout} className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

function getJwtExp(token: string): number | null {
  try {
    const base64 = token.split('.')[1];
    const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (token: string) => {
      clearRefreshTimer();
      const exp = getJwtExp(token);
      if (!exp) return;
      // Refresh 2 minutes before expiry
      const ms = (exp - Math.floor(Date.now() / 1000) - 120) * 1000;

      const doRefresh = async () => {
        const rt = localStorage.getItem('dlc_refresh_token');
        if (!rt) {
          router.push('/login');
          return;
        }
        try {
          const res = await fetch(`${siteConfig.apiGatewayUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) throw new Error('Refresh failed');
          const data = await res.json();
          localStorage.setItem('dlc_token', data.accessToken);
          localStorage.setItem('dlc_refresh_token', data.refreshToken);
          document.cookie = `dlc_token=${data.accessToken}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
          scheduleRefresh(data.accessToken);
        } catch {
          localStorage.removeItem('dlc_token');
          localStorage.removeItem('dlc_refresh_token');
          localStorage.removeItem('dlc_user');
          document.cookie = 'dlc_token=; path=/; max-age=0';
          router.push('/login');
        }
      };

      if (ms <= 0) {
        doRefresh();
        return;
      }
      refreshTimerRef.current = setTimeout(doRefresh, ms);
    },
    [clearRefreshTimer, router],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem('dlc_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.name) setUserName(user.name);
        if (user.email) setUserEmail(user.email);
      }
    } catch {}

    // Schedule token refresh
    const token = localStorage.getItem('dlc_token');
    if (token) {
      scheduleRefresh(token);
    }

    return () => clearRefreshTimer();
  }, [scheduleRefresh, clearRefreshTimer]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900">
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar userName={userName} userEmail={userEmail} />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 flex h-full">
            <Sidebar onClose={() => setMobileOpen(false)} userName={userName} userEmail={userEmail} />
          </div>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 lg:hidden">
          <div className="flex items-center">
            <button onClick={() => setMobileOpen(true)} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800">
              <Menu className="h-5 w-5" />
            </button>
            <span className="ml-3 text-sm font-bold text-zinc-50">AI-DLC Portal</span>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
