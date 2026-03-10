'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Bot,
  Building2,
  Globe,
  KeyRound,
  Package,
  Plug,
  RefreshCcw,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@unicore/ui';

interface SettingsNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    label: 'General',
    href: '/settings',
    icon: Building2,
    description: 'Business profile and preferences',
  },
  {
    label: 'Team & Roles',
    href: '/settings/team',
    icon: Users,
    description: 'Manage users and permissions',
  },
  {
    label: 'AI Agents',
    href: '/settings/agents',
    icon: Bot,
    description: 'Configure agent behavior and channels',
  },
  {
    label: 'ERP Modules',
    href: '/settings/erp',
    icon: Package,
    description: 'Enable or disable ERP features',
  },
  {
    label: 'Integrations',
    href: '/settings/integrations',
    icon: Plug,
    description: 'Connect external services',
  },
  {
    label: 'Domains',
    href: '/settings/domains',
    icon: Globe,
    description: 'Custom domain management and SSL',
  },
  {
    label: 'License',
    href: '/settings/license',
    icon: KeyRound,
    description: 'Manage your license and edition',
  },
  {
    label: 'Re-run Wizard',
    href: '/settings/wizard',
    icon: RefreshCcw,
    description: 'Reconfigure from the bootstrap wizard',
  },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Configure your UniCore platform</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar nav */}
        <nav className="flex flex-col gap-1 lg:w-56 lg:shrink-0">
          {settingsNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/settings' ? pathname === '/settings' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Page content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
