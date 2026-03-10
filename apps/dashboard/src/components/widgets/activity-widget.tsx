'use client';

import { Activity, Bot, Package, Receipt, ShoppingCart, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@unicore/ui';
import { useActivityData } from '@/hooks/use-widget-data';
import type { ActivityItem } from '@/types/widget';
import type { WidgetComponentProps } from './widget-registry';
import { WidgetErrorCard } from './widget-skeleton';

const activityIcons: Record<ActivityItem['type'], LucideIcon> = {
  order: ShoppingCart,
  invoice: Receipt,
  agent: Bot,
  contact: User,
  inventory: Package,
  system: Activity,
};

function ActivitySkeleton() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-20 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActivityWidget({ config }: WidgetComponentProps) {
  const { data, loading, error } = useActivityData(config.refreshInterval);

  if (loading) return <ActivitySkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.items.map((item) => {
            const Icon = activityIcons[item.type] ?? Activity;
            return (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 text-foreground">{item.message}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
