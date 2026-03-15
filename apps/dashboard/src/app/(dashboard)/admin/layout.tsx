'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ScrollText,
  Shield,
  UsersRound,
} from 'lucide-react';
import { cn } from '@unicore/ui';
import { useRequireAuth } from '@/hooks/use-auth';

const ADMIN_NAV = [
  { href: '/admin/users', label: 'Users', icon: UsersRound },
  { href: '/admin/roles', label: 'Roles & Access', icon: Shield },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/admin/health', label: 'System Health', icon: Activity },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { requireRole } = useRequireAuth();

  if (!requireRole(['owner'])) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">
          You do not have permission to access this area.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="flex gap-1 overflow-x-auto border-b pb-2 lg:w-56 lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
