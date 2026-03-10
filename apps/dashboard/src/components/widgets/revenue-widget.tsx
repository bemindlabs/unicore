'use client';

import { DollarSign } from 'lucide-react';
import { useRevenueData } from '@/hooks/use-widget-data';
import type { WidgetComponentProps } from './widget-registry';
import { MetricCard } from './metric-card';
import { WidgetSkeleton, WidgetErrorCard } from './widget-skeleton';

export function RevenueWidget({ config }: WidgetComponentProps) {
  const { data, loading, error } = useRevenueData(config.refreshInterval);

  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  return (
    <MetricCard
      title={config.title}
      value={data.metric.formatted}
      icon={DollarSign}
      trend={data.trend}
      description={data.description}
    />
  );
}
