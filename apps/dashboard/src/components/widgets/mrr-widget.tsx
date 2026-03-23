'use client';

import { TrendingUp } from 'lucide-react';
import { useMrrData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';

export function MrrWidget({ config }: WidgetComponentProps): JSX.Element | null {
  const { data, loading, error } = useMrrData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={TrendingUp}
      trend={data.trend}
      description={data.description}
    >
      {data.arr && (
        <p className="mt-1 text-xs text-muted-foreground">
          ARR: <span className="font-medium text-foreground">{data.arr.formatted}</span>
        </p>
      )}
    </MetricCard>
  );
}
