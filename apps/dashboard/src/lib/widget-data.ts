// Widget data fetching layer — wraps the api client with typed responses

import { api } from '@/lib/api';
import type {
  RevenueWidgetData,
  OrdersWidgetData,
  InventoryWidgetData,
  MrrWidgetData,
  ChurnWidgetData,
  SignupsWidgetData,
  ActivityWidgetData,
  ChartWidgetData,
} from '@/types/widget';

export const widgetDataFetchers = {
  revenue: (): Promise<RevenueWidgetData> =>
    api.get<RevenueWidgetData>('/api/v1/dashboard/widgets/revenue'),

  orders: (): Promise<OrdersWidgetData> =>
    api.get<OrdersWidgetData>('/api/v1/dashboard/widgets/orders'),

  inventory: (): Promise<InventoryWidgetData> =>
    api.get<InventoryWidgetData>('/api/v1/dashboard/widgets/inventory'),

  mrr: (): Promise<MrrWidgetData> =>
    api.get<MrrWidgetData>('/api/v1/dashboard/widgets/mrr'),

  churn: (): Promise<ChurnWidgetData> =>
    api.get<ChurnWidgetData>('/api/v1/dashboard/widgets/churn'),

  signups: (): Promise<SignupsWidgetData> =>
    api.get<SignupsWidgetData>('/api/v1/dashboard/widgets/signups'),

  activity: (): Promise<ActivityWidgetData> =>
    api.get<ActivityWidgetData>('/api/v1/dashboard/widgets/activity'),

  chart: (options: Record<string, unknown>): Promise<ChartWidgetData> =>
    api.get<ChartWidgetData>(
      `/api/v1/dashboard/widgets/chart?metric=${options.metric ?? 'revenue'}&period=${options.period ?? '30d'}`,
    ),
};

// --- Mock data for development / when API is unavailable ---

export const mockWidgetData = {
  revenue: (): RevenueWidgetData => ({
    metric: {
      current: 45231.89,
      previous: 40284.0,
      currency: 'USD',
      formatted: '$45,231.89',
    },
    trend: { value: 12.3, positive: true, label: 'vs last month' },
    description: 'from last month',
    breakdown: [
      { label: 'Products', value: 30000 },
      { label: 'Services', value: 12000 },
      { label: 'Subscriptions', value: 3231.89 },
    ],
    chartData: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      value: Math.round(800 + Math.random() * 800),
    })),
  }),

  orders: (): OrdersWidgetData => ({
    metric: { current: 356, previous: 329, formatted: '356' },
    trend: { value: 8.2, positive: true, label: 'vs last month' },
    description: 'from last month',
    pendingCount: 42,
    processingCount: 18,
    completedCount: 296,
  }),

  inventory: (): InventoryWidgetData => ({
    metric: { current: 1284, previous: 1350, formatted: '1,284 SKUs' },
    trend: { value: -4.9, positive: false, label: 'vs last month' },
    description: 'total SKUs tracked',
    lowStockCount: 23,
    outOfStockCount: 7,
    totalSkus: 1284,
  }),

  mrr: (): MrrWidgetData => ({
    metric: {
      current: 12400,
      previous: 11750,
      currency: 'USD',
      formatted: '$12,400',
    },
    trend: { value: 5.5, positive: true, label: 'vs last month' },
    description: 'monthly recurring revenue',
    arr: { current: 148800, currency: 'USD', formatted: '$148,800' },
    expansion: { current: 1200, currency: 'USD', formatted: '$1,200' },
    contraction: { current: 550, currency: 'USD', formatted: '$550' },
  }),

  churn: (): ChurnWidgetData => ({
    metric: { current: 2.4, unit: '%', formatted: '2.4%' },
    trend: { value: -0.3, positive: true, label: 'vs last month' },
    description: 'monthly churn rate',
    churned: 12,
    rate: 2.4,
    retentionRate: 97.6,
  }),

  signups: (): SignupsWidgetData => ({
    metric: { current: 148, previous: 132, formatted: '148' },
    trend: { value: 12.1, positive: true, label: 'vs last month' },
    description: 'new signups this month',
    dailyAverage: 4.9,
    weeklyTotal: 34,
    conversionRate: 3.2,
  }),

  activity: (): ActivityWidgetData => ({
    items: [
      { id: '1', message: 'New order #1042 received from Acme Corp', time: '2 minutes ago', type: 'order' },
      { id: '2', message: 'Invoice #892 marked as paid — $3,200', time: '15 minutes ago', type: 'invoice' },
      { id: '3', message: 'AI Agent completed lead qualification for 8 contacts', time: '1 hour ago', type: 'agent' },
      { id: '4', message: 'New contact added: Jane Smith (Acme Corp)', time: '2 hours ago', type: 'contact' },
      { id: '5', message: 'Inventory alert: Widget A (SKU-042) below reorder level', time: '3 hours ago', type: 'inventory' },
      { id: '6', message: 'Workflow "Daily Report" completed successfully', time: '4 hours ago', type: 'system' },
    ],
  }),

  chart: (): ChartWidgetData => ({
    title: 'Revenue — Last 30 Days',
    yAxisLabel: 'USD',
    points: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
      value: Math.round(800 + Math.random() * 800),
    })),
  }),
} as const;
