'use client';

import { ShoppingCart } from 'lucide-react';
import { useOrdersData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';
import { Badge } from '@unicore/ui';

export function OrdersWidget({ config }: WidgetComponentProps): JSX.Element | null {
  const { data, loading, error } = useOrdersData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={ShoppingCart}
      trend={data.trend}
      description={data.description}
    >
      <div className="mt-2 flex gap-1.5">
        <Badge variant="outline" className="text-xs">
          {data.pendingCount} pending
        </Badge>
        <Badge variant="outline" className="text-xs">
          {data.processingCount} processing
        </Badge>
      </div>
    </MetricCard>
  );
}
