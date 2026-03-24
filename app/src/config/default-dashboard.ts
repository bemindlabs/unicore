// Default dashboard configuration — mirrors what would be in unicore.config.json
// The runtime config is loaded from the API, this serves as fallback

import type { DashboardConfig } from '@/types/widget';

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  columns: 4,
  refreshInterval: 60,
  widgets: [
    {
      id: 'revenue-total',
      type: 'revenue',
      title: 'Total Revenue',
      size: '1x1',
      enabled: true,
      refreshInterval: 60,
    },
    {
      id: 'orders-count',
      type: 'orders',
      title: 'Orders',
      size: '1x1',
      enabled: true,
      refreshInterval: 30,
    },
    {
      id: 'mrr-current',
      type: 'mrr',
      title: 'Monthly Recurring Revenue',
      size: '1x1',
      enabled: true,
      refreshInterval: 300,
    },
    {
      id: 'signups-recent',
      type: 'signups',
      title: 'New Signups',
      size: '1x1',
      enabled: true,
      refreshInterval: 60,
    },
    {
      id: 'inventory-status',
      type: 'inventory',
      title: 'Inventory Status',
      size: '1x1',
      enabled: true,
      refreshInterval: 120,
    },
    {
      id: 'churn-rate',
      type: 'churn',
      title: 'Churn Rate',
      size: '1x1',
      enabled: true,
      refreshInterval: 300,
    },
    {
      id: 'revenue-chart',
      type: 'chart',
      title: 'Revenue Overview',
      size: '2x1',
      enabled: true,
      refreshInterval: 300,
      options: { metric: 'revenue', period: '30d' },
    },
    {
      id: 'activity-feed',
      type: 'activity',
      title: 'Recent Activity',
      size: '2x1',
      enabled: true,
      refreshInterval: 30,
    },
  ],
};
