'use client';

import { UserMinus } from 'lucide-react';
import { useChurnData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';
import { Progress } from '@bemindlabs/unicore-ui';

export function ChurnWidget({ config }: WidgetComponentProps): JSX.Element | null {
  const { data, loading, error } = useChurnData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={UserMinus}
      trend={data.trend}
      description={data.description}
    >
      <div className="mt-2 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Retention</span>
          <span className="font-medium text-foreground">{data.retentionRate.toFixed(1)}%</span>
        </div>
        <Progress value={data.retentionRate} className="h-1.5" />
      </div>
    </MetricCard>
  );
}
