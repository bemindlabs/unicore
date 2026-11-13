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
    api.get<RevenueWidgetData>('/api/proxy/erp/dashboard/revenue'),

  orders: (): Promise<OrdersWidgetData> =>
    api.get<OrdersWidgetData>('/api/proxy/erp/dashboard/orders'),

  inventory: (): Promise<InventoryWidgetData> =>
    api.get<InventoryWidgetData>('/api/proxy/erp/dashboard/inventory'),

  mrr: (): Promise<MrrWidgetData> =>
    api.get<MrrWidgetData>('/api/proxy/erp/dashboard/mrr'),

  churn: (): Promise<ChurnWidgetData> =>
    api.get<ChurnWidgetData>('/api/proxy/erp/dashboard/churn'),

  signups: (): Promise<SignupsWidgetData> =>
    api.get<SignupsWidgetData>('/api/proxy/erp/dashboard/signups'),

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
      `/api/proxy/erp/dashboard/chart?metric=${options.metric ?? 'revenue'}&period=${options.period ?? '30d'}`,
    ),
};
