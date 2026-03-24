'use client';

import { Package } from 'lucide-react';
import { useInventoryData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';
import { Badge } from '@bemindlabs/unicore-ui';

export function InventoryWidget({ config }: WidgetComponentProps): JSX.Element | null {
  const { data, loading, error } = useInventoryData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={Package}
      trend={data.trend}
      description={data.description}
    >
      {(data.lowStockCount > 0 || data.outOfStockCount > 0) && (
        <div className="mt-2 flex gap-1.5">
          {data.lowStockCount > 0 && (
            <Badge variant="outline" className="border-amber-400 text-xs text-amber-600 dark:text-amber-400">
              {data.lowStockCount} low stock
            </Badge>
          )}
          {data.outOfStockCount > 0 && (
            <Badge variant="outline" className="border-destructive text-xs text-destructive">
              {data.outOfStockCount} out of stock
            </Badge>
          )}
        </div>
      )}
    </MetricCard>
  );
}
