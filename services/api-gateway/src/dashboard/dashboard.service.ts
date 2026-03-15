import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawCount {
  count: bigint;
}

interface RawSum {
  total: bigint | null;
}

interface RawDateValue {
  date: string;
  value: bigint;
}

interface RawActivity {
  id: string;
  message: string;
  created_at: Date;
  type: string;
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function parsePeriodDays(period: string): number {
  const match = period.match(/^(\d+)d$/);
  return match ? parseInt(match[1], 10) : 30;
}

function dateNDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function trendValue(current: number, previous: number): { value: number; positive: boolean; label: string } {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, positive: current >= 0, label: 'vs last month' };
  }
  const pct = parseFloat((((current - previous) / previous) * 100).toFixed(1));
  return { value: pct, positive: pct >= 0, label: 'vs last month' };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly erpBaseUrl: string;

  constructor(private readonly prisma: PrismaService) {
    const host = process.env.ERP_SERVICE_HOST ?? 'localhost';
    const port = process.env.ERP_SERVICE_PORT ?? '4100';
    this.erpBaseUrl = `http://${host}:${port}`;
  }

  // ---- ERP fetch helper ---------------------------------------------------

  private async erpFetch<T>(path: string): Promise<T> {
    const url = `${this.erpBaseUrl}${path}`;
    this.logger.debug(`ERP request: GET ${url}`);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`ERP ${path} returned ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  // ---- Config -------------------------------------------------------------

  getDashboardConfig() {
    return {
      columns: 4,
      refreshInterval: 60,
      widgets: [
        { id: 'revenue-total', type: 'revenue', title: 'Total Revenue', size: '1x1', enabled: true, refreshInterval: 60 },
        { id: 'orders-count', type: 'orders', title: 'Orders', size: '1x1', enabled: true, refreshInterval: 30 },
        { id: 'mrr-current', type: 'mrr', title: 'Monthly Recurring Revenue', size: '1x1', enabled: true, refreshInterval: 300 },
        { id: 'signups-recent', type: 'signups', title: 'New Signups', size: '1x1', enabled: true, refreshInterval: 60 },
        { id: 'inventory-status', type: 'inventory', title: 'Inventory Status', size: '1x1', enabled: true, refreshInterval: 120 },
        { id: 'churn-rate', type: 'churn', title: 'Churn Rate', size: '1x1', enabled: true, refreshInterval: 300 },
        { id: 'revenue-chart', type: 'chart', title: 'Revenue Overview', size: '2x1', enabled: true, refreshInterval: 300, options: { metric: 'revenue', period: '30d' } },
        { id: 'activity-feed', type: 'activity', title: 'Recent Activity', size: '2x1', enabled: true, refreshInterval: 30 },
      ],
    };
  }

  // ---- Revenue ------------------------------------------------------------

  async getRevenueWidget() {
    try {
      const revenueData = await this.erpFetch<{
        totalRevenue?: number;
        currentMonth?: number;
        previousMonth?: number;
        chartData?: Array<{ date: string; value: number }>;
      }>('/reports/revenue');

      const currentRevenue = revenueData.currentMonth ?? revenueData.totalRevenue ?? 0;
      const previousRevenue = revenueData.previousMonth ?? 0;
      const chartData = revenueData.chartData ?? this.emptyDateSeries(30);
      const trend = trendValue(currentRevenue, previousRevenue);

      return {
        metric: {
          current: currentRevenue,
          previous: previousRevenue,
          currency: 'USD',
          formatted: formatCurrency(currentRevenue),
        },
        trend,
        description: 'from last month',
        breakdown: [],
        chartData,
      };
    } catch (error) {
      this.logger.warn(`ERP revenue call failed, falling back to DB: ${(error as Error).message}`);
      return this.getRevenueWidgetFallback();
    }
  }

  private async getRevenueWidgetFallback() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentRevenue, previousRevenue, chartData] = await Promise.all([
      this.safeSum('orders', 'total_amount', `"created_at" >= '${startOfMonth.toISOString()}'`),
      this.safeSum('orders', 'total_amount', `"created_at" >= '${startOfLastMonth.toISOString()}' AND "created_at" < '${startOfMonth.toISOString()}'`),
      this.safeRevenueChart(30),
    ]);

    const trend = trendValue(currentRevenue, previousRevenue);

    return {
      metric: {
        current: currentRevenue,
        previous: previousRevenue,
        currency: 'USD',
        formatted: formatCurrency(currentRevenue),
      },
      trend,
      description: 'from last month',
      breakdown: [],
      chartData,
    };
  }

  // ---- Orders -------------------------------------------------------------

  async getOrdersWidget() {
    try {
      const ordersData = await this.erpFetch<{
        data: Array<{ id: string; status: string; created_at: string }>;
        meta: { total: number };
      }>('/orders');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const orders = ordersData.data;
      const currentCount = orders.filter(o => new Date(o.created_at) >= startOfMonth).length;
      const previousCount = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= startOfLastMonth && d < startOfMonth;
      }).length;
      const pendingCount = orders.filter(o => o.status === 'pending').length;
      const processingCount = orders.filter(o => o.status === 'processing').length;
      const completedCount = orders.filter(o => o.status === 'completed').length;

      const trend = trendValue(currentCount, previousCount);

      return {
        metric: { current: currentCount, previous: previousCount, formatted: formatNumber(currentCount) },
        trend,
        description: 'from last month',
        pendingCount,
        processingCount,
        completedCount,
      };
    } catch (error) {
      this.logger.warn(`ERP orders call failed, falling back to DB: ${(error as Error).message}`);
      return this.getOrdersWidgetFallback();
    }
  }

  private async getOrdersWidgetFallback() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [currentCount, previousCount, pendingCount, processingCount, completedCount] = await Promise.all([
      this.safeCount('orders', `"created_at" >= '${startOfMonth.toISOString()}'`),
      this.safeCount('orders', `"created_at" >= '${startOfLastMonth.toISOString()}' AND "created_at" < '${startOfMonth.toISOString()}'`),
      this.safeCount('orders', `"status" = 'pending'`),
      this.safeCount('orders', `"status" = 'processing'`),
      this.safeCount('orders', `"status" = 'completed'`),
    ]);

    const trend = trendValue(currentCount, previousCount);

    return {
      metric: { current: currentCount, previous: previousCount, formatted: formatNumber(currentCount) },
      trend,
      description: 'from last month',
      pendingCount,
      processingCount,
      completedCount,
    };
  }

  // ---- Inventory ----------------------------------------------------------

  async getInventoryWidget() {
    try {
      const inventoryData = await this.erpFetch<{
        data: Array<{ id: string; quantity: number; reorder_level?: number; reorderLevel?: number }>;
        meta: { total: number };
      }>('/inventory');

      const items = inventoryData.data;
      const totalSkus = inventoryData.meta.total;
      const lowStockCount = items.filter(i => {
        const reorder = i.reorder_level ?? i.reorderLevel ?? 0;
        return i.quantity > 0 && i.quantity <= reorder;
      }).length;
      const outOfStockCount = items.filter(i => i.quantity === 0).length;

      return {
        metric: {
          current: totalSkus,
          previous: 0,
          formatted: `${formatNumber(totalSkus)} SKUs`,
        },
        trend: { value: 0, positive: true, label: 'vs last month' },
        description: 'total SKUs tracked',
        lowStockCount,
        outOfStockCount,
        totalSkus,
      };
    } catch (error) {
      this.logger.warn(`ERP inventory call failed, falling back to DB: ${(error as Error).message}`);
      return this.getInventoryWidgetFallback();
    }
  }

  private async getInventoryWidgetFallback() {
    const [totalSkus, lowStockCount, outOfStockCount] = await Promise.all([
      this.safeCount('inventory_items'),
      this.safeCount('inventory_items', `"quantity" > 0 AND "quantity" <= "reorder_level"`),
      this.safeCount('inventory_items', `"quantity" = 0`),
    ]);

    return {
      metric: {
        current: totalSkus,
        previous: 0,
        formatted: `${formatNumber(totalSkus)} SKUs`,
      },
      trend: { value: 0, positive: true, label: 'vs last month' },
      description: 'total SKUs tracked',
      lowStockCount,
      outOfStockCount,
      totalSkus,
    };
  }

  // ---- MRR (mock — no real data source) -----------------------------------

  async getMrrWidget() {
    const mrr = await this.safeSum('subscriptions', 'monthly_amount', `"status" = 'active'`);
    const arr = mrr * 12;

    return {
      metric: {
        current: mrr,
        previous: 0,
        currency: 'USD',
        formatted: formatCurrency(mrr),
      },
      trend: { value: 0, positive: true, label: 'vs last month' },
      description: 'monthly recurring revenue',
      arr: { current: arr, currency: 'USD', formatted: formatCurrency(arr) },
      expansion: { current: 0, currency: 'USD', formatted: formatCurrency(0) },
      contraction: { current: 0, currency: 'USD', formatted: formatCurrency(0) },
    };
  }

  // ---- Churn (mock — no real data source) ---------------------------------

  async getChurnWidget() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalActive, churnedThisMonth] = await Promise.all([
      this.safeCount('subscriptions', `"status" = 'active'`),
      this.safeCount('subscriptions', `"status" = 'cancelled' AND "cancelled_at" >= '${startOfMonth.toISOString()}'`),
    ]);

    const totalForRate = totalActive + churnedThisMonth;
    const rate = totalForRate > 0 ? parseFloat(((churnedThisMonth / totalForRate) * 100).toFixed(1)) : 0;
    const retentionRate = parseFloat((100 - rate).toFixed(1));

    return {
      metric: { current: rate, unit: '%', formatted: `${rate}%` },
      trend: { value: 0, positive: true, label: 'vs last month' },
      description: 'monthly churn rate',
      churned: churnedThisMonth,
      rate,
      retentionRate,
    };
  }

  // ---- Signups (mock — no real signup tracking) ---------------------------

  async getSignupsWidget() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const oneWeekAgo = dateNDaysAgo(7);

    const [currentCount, previousCount, weeklyTotal] = await Promise.all([
      this.safeUserCount(`"createdAt" >= '${startOfMonth.toISOString()}'`),
      this.safeUserCount(`"createdAt" >= '${startOfLastMonth.toISOString()}' AND "createdAt" < '${startOfMonth.toISOString()}'`),
      this.safeUserCount(`"createdAt" >= '${oneWeekAgo.toISOString()}'`),
    ]);

    const dayOfMonth = now.getDate();
    const dailyAverage = dayOfMonth > 0 ? parseFloat((currentCount / dayOfMonth).toFixed(1)) : 0;
    const trend = trendValue(currentCount, previousCount);

    return {
      metric: { current: currentCount, previous: previousCount, formatted: formatNumber(currentCount) },
      trend,
      description: 'new signups this month',
      dailyAverage,
      weeklyTotal,
      conversionRate: 0,
    };
  }

  // ---- Activity -----------------------------------------------------------

  async getActivityWidget() {
    try {
      const contactsData = await this.erpFetch<{
        data: Array<{ id: string; name: string; created_at?: string; createdAt?: string }>;
        meta: { total: number };
      }>('/contacts?limit=5');

      const items = contactsData.data.map(c => ({
        id: c.id,
        message: `New contact: ${c.name}`,
        time: this.timeAgo(new Date(c.created_at ?? c.createdAt ?? Date.now())),
        type: 'contact' as const,
      }));

      // Also try to get recent orders for activity
      try {
        const ordersData = await this.erpFetch<{
          data: Array<{ id: string; created_at?: string; createdAt?: string }>;
          meta: { total: number };
        }>('/orders?limit=5');

        for (const o of ordersData.data.slice(0, 5)) {
          items.push({
            id: o.id,
            message: `New order #${o.id}`,
            time: this.timeAgo(new Date(o.created_at ?? o.createdAt ?? Date.now())),
            type: 'order' as const,
          });
        }
      } catch {
        // orders endpoint failed — continue with contacts only
      }

      // Sort by recency (most recent first) and limit to 10
      return { items: items.slice(0, 10) };
    } catch (error) {
      this.logger.warn(`ERP activity call failed, falling back to DB: ${(error as Error).message}`);
      const items = await this.safeActivityFeed();
      return { items };
    }
  }

  // ---- Chart --------------------------------------------------------------

  async getChartWidget(metric: string, period: string) {
    const days = parsePeriodDays(period);
    let points: Array<{ date: string; value: number }>;

    switch (metric) {
      case 'orders':
        points = await this.safeDailyOrderCounts(days);
        break;
      case 'signups':
        points = await this.safeDailySignupCounts(days);
        break;
      case 'revenue':
      default:
        points = await this.getChartRevenuePoints(days);
        break;
    }

    const labelMap: Record<string, string> = {
      revenue: 'USD',
      orders: 'Orders',
      signups: 'Signups',
    };

    return {
      title: `${(metric.charAt(0).toUpperCase() + metric.slice(1))} — Last ${days} Days`,
      yAxisLabel: labelMap[metric] ?? metric,
      points,
    };
  }

  private async getChartRevenuePoints(days: number): Promise<Array<{ date: string; value: number }>> {
    try {
      const revenueData = await this.erpFetch<{
        chartData?: Array<{ date: string; value: number }>;
        data?: Array<{ date: string; value: number }>;
      }>('/reports/revenue');

      const points = revenueData.chartData ?? revenueData.data;
      if (points && points.length > 0) {
        return points;
      }
      return this.safeRevenueChart(days);
    } catch {
      return this.safeRevenueChart(days);
    }
  }

  // =========================================================================
  // Safe database helpers — return sensible defaults when tables don't exist
  // =========================================================================

  private async safeCount(table: string, where?: string): Promise<number> {
    try {
      const whereClause = where ? `WHERE ${where}` : '';
      const result = await this.prisma.$queryRawUnsafe<RawCount[]>(
        `SELECT COUNT(*)::bigint AS count FROM "${table}" ${whereClause}`,
      );
      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.debug(`Table "${table}" not available: ${(error as Error).message}`);
      return 0;
    }
  }

  private async safeUserCount(where?: string): Promise<number> {
    try {
      const whereClause = where ? `WHERE ${where}` : '';
      const result = await this.prisma.$queryRawUnsafe<RawCount[]>(
        `SELECT COUNT(*)::bigint AS count FROM "User" ${whereClause}`,
      );
      return Number(result[0]?.count ?? 0);
    } catch (error) {
      this.logger.debug(`User table query failed: ${(error as Error).message}`);
      return 0;
    }
  }

  private async safeSum(table: string, column: string, where?: string): Promise<number> {
    try {
      const whereClause = where ? `WHERE ${where}` : '';
      const result = await this.prisma.$queryRawUnsafe<RawSum[]>(
        `SELECT COALESCE(SUM("${column}"), 0)::bigint AS total FROM "${table}" ${whereClause}`,
      );
      return Number(result[0]?.total ?? 0);
    } catch (error) {
      this.logger.debug(`Table "${table}" sum query failed: ${(error as Error).message}`);
      return 0;
    }
  }

  private async safeRevenueChart(days: number): Promise<Array<{ date: string; value: number }>> {
    const since = dateNDaysAgo(days);
    try {
      const rows = await this.prisma.$queryRawUnsafe<RawDateValue[]>(
        `SELECT "created_at"::date::text AS date, COALESCE(SUM("total_amount"), 0)::bigint AS value
         FROM "orders"
         WHERE "created_at" >= $1
         GROUP BY "created_at"::date
         ORDER BY "created_at"::date ASC`,
        since,
      );
      return this.fillDateGaps(rows, days);
    } catch {
      return this.emptyDateSeries(days);
    }
  }

  private async safeDailyOrderCounts(days: number): Promise<Array<{ date: string; value: number }>> {
    const since = dateNDaysAgo(days);
    try {
      const rows = await this.prisma.$queryRawUnsafe<RawDateValue[]>(
        `SELECT "created_at"::date::text AS date, COUNT(*)::bigint AS value
         FROM "orders"
         WHERE "created_at" >= $1
         GROUP BY "created_at"::date
         ORDER BY "created_at"::date ASC`,
        since,
      );
      return this.fillDateGaps(rows, days);
    } catch {
      return this.emptyDateSeries(days);
    }
  }

  private async safeDailySignupCounts(days: number): Promise<Array<{ date: string; value: number }>> {
    const since = dateNDaysAgo(days);
    try {
      const rows = await this.prisma.$queryRawUnsafe<RawDateValue[]>(
        `SELECT "createdAt"::date::text AS date, COUNT(*)::bigint AS value
         FROM "User"
         WHERE "createdAt" >= $1
         GROUP BY "createdAt"::date
         ORDER BY "createdAt"::date ASC`,
        since,
      );
      return this.fillDateGaps(rows, days);
    } catch {
      return this.emptyDateSeries(days);
    }
  }

  private async safeActivityFeed(): Promise<Array<{ id: string; message: string; time: string; type: string }>> {
    const queries: Array<{ sql: string; type: string }> = [
      {
        sql: `SELECT id, CONCAT('New order #', "id") AS message, "created_at", 'order' AS type FROM "orders" ORDER BY "created_at" DESC LIMIT 3`,
        type: 'order',
      },
      {
        sql: `SELECT id, CONCAT('Invoice #', "id") AS message, "created_at", 'invoice' AS type FROM "invoices" ORDER BY "created_at" DESC LIMIT 3`,
        type: 'invoice',
      },
      {
        sql: `SELECT id, CONCAT('New contact: ', "name") AS message, "created_at", 'contact' AS type FROM "contacts" ORDER BY "created_at" DESC LIMIT 3`,
        type: 'contact',
      },
    ];

    const items: Array<{ id: string; message: string; time: string; type: string }> = [];

    try {
      const users = await this.prisma.$queryRawUnsafe<RawActivity[]>(
        `SELECT id, CONCAT('New user: ', "name") AS message, "createdAt" AS created_at, 'contact' AS type
         FROM "User"
         ORDER BY "createdAt" DESC
         LIMIT 5`,
      );
      for (const row of users) {
        items.push({
          id: row.id,
          message: row.message,
          time: this.timeAgo(new Date(row.created_at)),
          type: row.type,
        });
      }
    } catch {
      // User table may be empty
    }

    for (const q of queries) {
      try {
        const rows = await this.prisma.$queryRawUnsafe<RawActivity[]>(q.sql);
        for (const row of rows) {
          items.push({
            id: row.id,
            message: row.message,
            time: this.timeAgo(new Date(row.created_at)),
            type: row.type,
          });
        }
      } catch {
        // table doesn't exist yet — skip
      }
    }

    return items.slice(0, 10);
  }

  // ---- Date utilities -----------------------------------------------------

  private fillDateGaps(rows: RawDateValue[], days: number): Array<{ date: string; value: number }> {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.date, Number(row.value));
    }

    const result: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = dateNDaysAgo(i);
      const key = d.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
    }
    return result;
  }

  private emptyDateSeries(days: number): Array<{ date: string; value: number }> {
    const result: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      result.push({ date: dateNDaysAgo(i).toISOString().slice(0, 10), value: 0 });
    }
    return result;
  }

  private timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
}
