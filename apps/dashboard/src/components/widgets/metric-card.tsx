// Reusable metric card — wraps the common layout for stat widgets

'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@unicore/ui';
import type { TrendData } from '@/types/widget';

interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: TrendData;
  children?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  children,
  className,
}: MetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>

        {(trend ?? description) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  'font-medium',
                  trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                )}
              >
                {trend.positive ? '+' : ''}
                {typeof trend.value === 'number' && Math.abs(trend.value) < 100
                  ? trend.value.toFixed(1)
                  : trend.value}
                {trend.label ? '' : '%'}
              </span>
            )}
            {trend?.label && (
              <span className={cn('font-medium', trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                {' '}
                {trend.label}
              </span>
            )}
            {trend && description && ' '}
            {description}
          </p>
        )}

        {children}
      </CardContent>
    </Card>
  );
}
