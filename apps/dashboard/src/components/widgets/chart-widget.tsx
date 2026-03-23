'use client';

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@unicore/ui';
import { useChartData } from '@/hooks/use-widget-data';
import type { ChartPoint } from '@/types/widget';
import type { WidgetComponentProps } from './widget-registry';
import { WidgetErrorCard } from './widget-skeleton';

// Lightweight SVG sparkline — no external chart library required
function Sparkline({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 100;
  const height = 40;
  const pad = 2;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + ((max - p.value) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = coords.join(' ');

  // Area fill path
  const first = coords[0] ?? `${pad},${height - pad}`;
  const last = coords[coords.length - 1] ?? `${width - pad},${height - pad}`;
  const area = `${first} ${polyline} ${last} ${width - pad},${height - pad} ${pad},${height - pad}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: '100%' }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={area} className="fill-primary/10" />
      <polyline
        points={polyline}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChartSkeleton() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function ChartWidget({ config }: WidgetComponentProps): JSX.Element | null {
  const { data, loading, error } = useChartData(config.options, config.refreshInterval);

  if (loading) return <ChartSkeleton />;
  if (error) return <WidgetErrorCard message={error} />;
  if (!data) return null;

  const values = data.points.map((p) => p.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const avg = total / (values.length || 1);
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? last;
  const trendUp = last >= prev;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">
            {data.yAxisLabel === 'USD' ? '$' : ''}
            {avg.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className={`text-xs font-medium ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {trendUp ? '+' : '-'}
            {Math.abs(((last - prev) / (prev || 1)) * 100).toFixed(1)}% vs prev
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-40">
          <Sparkline points={data.points} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{data.points[0]?.date}</span>
          <span>{data.points[data.points.length - 1]?.date}</span>
        </div>
      </CardContent>
    </Card>
  );
}
