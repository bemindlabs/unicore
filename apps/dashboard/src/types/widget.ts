// Widget framework types for the UniCore dashboard

export type WidgetType =
  | 'revenue'
  | 'orders'
  | 'inventory'
  | 'mrr'
  | 'churn'
  | 'signups'
  | 'activity'
  | 'chart';

export type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2' | '3x1' | '4x1';

export interface WidgetPosition {
  col: number;
  row: number;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size?: WidgetSize;
  position?: WidgetPosition;
  refreshInterval?: number; // seconds
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface DashboardConfig {
  widgets: WidgetConfig[];
  columns?: number;
  refreshInterval?: number; // default refresh for all widgets in seconds
}

export interface WidgetData<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

export interface MetricValue {
  current: number;
  previous?: number;
  currency?: string;
  unit?: string;
  formatted: string;
}

export interface TrendData {
  value: number;
  positive: boolean;
  label?: string;
}

export interface BaseWidgetData {
  metric: MetricValue;
  trend?: TrendData;
  description?: string;
}

export interface RevenueWidgetData extends BaseWidgetData {
  breakdown?: Array<{ label: string; value: number }>;
  chartData?: Array<{ date: string; value: number }>;
}

export interface OrdersWidgetData extends BaseWidgetData {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
}

export interface InventoryWidgetData extends BaseWidgetData {
  lowStockCount: number;
  outOfStockCount: number;
  totalSkus: number;
}

export interface MrrWidgetData extends BaseWidgetData {
  arr?: MetricValue;
  expansion?: MetricValue;
  contraction?: MetricValue;
}

export interface ChurnWidgetData extends BaseWidgetData {
  churned: number;
  rate: number; // percentage
  retentionRate: number; // percentage
}

export interface SignupsWidgetData extends BaseWidgetData {
  dailyAverage: number;
  weeklyTotal: number;
  conversionRate?: number; // percentage
}

export interface ActivityItem {
  id: string;
  message: string;
  time: string;
  type: 'order' | 'invoice' | 'agent' | 'contact' | 'inventory' | 'system';
}

export interface ActivityWidgetData {
  items: ActivityItem[];
}

export interface ChartPoint {
  date: string;
  value: number;
  label?: string;
}

export interface ChartWidgetData {
  title: string;
  points: ChartPoint[];
  yAxisLabel?: string;
}
