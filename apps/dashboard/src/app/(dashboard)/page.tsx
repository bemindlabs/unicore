import { Bot, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { WidgetGrid } from '@/components/dashboard/widget-grid';
import { StatsWidget } from '@/components/dashboard/stats-widget';
import { ChartWidget } from '@/components/dashboard/chart-widget';
import { ActivityWidget } from '@/components/dashboard/activity-widget';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business operations</p>
      </div>

      <WidgetGrid>
        <StatsWidget
          title="Total Revenue"
          value="$45,231"
          icon={DollarSign}
          trend={{ value: 12.5, positive: true }}
          description="from last month"
        />
        <StatsWidget
          title="Orders"
          value="356"
          icon={ShoppingCart}
          trend={{ value: 8.2, positive: true }}
          description="from last month"
        />
        <StatsWidget
          title="Contacts"
          value="2,350"
          icon={Users}
          trend={{ value: 3.1, positive: true }}
          description="from last month"
        />
        <StatsWidget title="Active Agents" value="4" icon={Bot} description="of 8 configured" />
      </WidgetGrid>

      <div className="grid gap-4 lg:grid-cols-4">
        <ChartWidget title="Revenue Overview" />
        <ActivityWidget />
      </div>
    </div>
  );
}
