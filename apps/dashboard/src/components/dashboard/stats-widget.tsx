import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@unicore/ui';

interface StatsWidgetProps {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; positive: boolean };
}

export function StatsWidget({ title, value, description, icon: Icon, trend }: StatsWidgetProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  'font-medium',
                  trend.positive ? 'text-secondary' : 'text-destructive',
                )}
              >
                {trend.positive ? '+' : ''}
                {trend.value}%
              </span>
            )}
            {trend && description && ' '}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
