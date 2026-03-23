'use client';

import { useAuth } from '@/hooks/use-auth';
import { DynamicWidgetGrid } from '@/components/dashboard/widget-grid';

export default function DashboardPage(): JSX.Element {
  const { user } = useAuth();

  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening across your business today.
        </p>
      </div>

      <DynamicWidgetGrid />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
