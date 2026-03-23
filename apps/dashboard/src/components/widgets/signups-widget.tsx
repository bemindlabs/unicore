'use client';

import { UserPlus } from 'lucide-react';
import { useSignupsData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';

export function SignupsWidget({ config }: WidgetComponentProps): JSX.Element {
  const { data, loading, error } = useSignupsData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={UserPlus}
      trend={data.trend}
      description={data.description}
    >
      <p className="mt-1 text-xs text-muted-foreground">
        ~{data.dailyAverage.toFixed(1)} per day
        {data.conversionRate !== undefined && (
          <> &middot; {data.conversionRate}% conversion</>
        )}
      </p>
    </MetricCard>
  );
}
