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
  ActivityItem,
  ChartWidgetData,
} from '@/types/widget';

// --- Audit log helpers ---

interface AuditLogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  detail?: string;
  success?: boolean;
  createdAt: string;
}

function auditActionToType(action: string, resource: string): ActivityItem['type'] {
  const r = resource.toLowerCase();
  const a = action.toLowerCase();
  if (r === 'orders' || r === 'order' || a === 'order') return 'order';
  if (r === 'invoices' || r === 'invoice' || a === 'invoice') return 'invoice';
  if (r === 'agents' || r === 'agent' || a === 'agent') return 'agent';
  if (r === 'contacts' || r === 'contact' || a === 'contact') return 'contact';
  if (r === 'inventory' || r === 'products' || r === 'product') return 'inventory';
  return 'system';
}

function toRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

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

  activity: async (): Promise<ActivityWidgetData> => {
    const res = await api.get<{ data: AuditLogEntry[] }>('/api/v1/audit-logs?limit=10&sort=desc');
    const logs: AuditLogEntry[] = res?.data ?? [];
    if (logs.length === 0) {
      return { items: [{ id: 'empty', message: 'No recent activity', time: '', type: 'system' }] };
    }
    return {
      items: logs.map((log) => ({
        id: log.id,
        message: log.detail ?? `${log.action} on ${log.resource}`,
        time: toRelativeTime(log.createdAt),
        type: auditActionToType(log.action, log.resource),
      })),
    };
  },

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
