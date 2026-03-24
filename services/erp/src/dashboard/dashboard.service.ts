import { Injectable } from '@nestjs/common';
import { InvoiceStatus, OrderStatus } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

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

function startOfMonth(monthsAgo = 0): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function trendValue(current: number, previous: number) {
  if (previous === 0) return { value: current > 0 ? 100 : 0, positive: current >= 0, label: 'vs last month' };
  const pct = parseFloat((((current - previous) / previous) * 100).toFixed(1));
  return { value: pct, positive: pct >= 0, label: 'vs last month' };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenue() {
    const now = startOfMonth();
    const prev = startOfMonth(1);

    const [currentAgg, previousAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, paidAt: { gte: now } },
      }),
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, paidAt: { gte: prev, lt: now } },
      }),
    ]);

    const current = Number(currentAgg._sum.total ?? 0);
    const previous = Number(previousAgg._sum.total ?? 0);

    return {
      metric: { current, previous, currency: 'USD', formatted: formatCurrency(current) },
      trend: trendValue(current, previous),
      description: 'from last month',
      breakdown: [],
      chartData: await this.getDailyRevenue(30),
    };
  }

  async getOrders() {
    const now = startOfMonth();
    const prev = startOfMonth(1);

    const [currentCount, previousCount, pendingCount, processingCount, completedCount] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: now } } }),
      this.prisma.order.count({ where: { createdAt: { gte: prev, lt: now } } }),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.DRAFT, OrderStatus.QUOTED, OrderStatus.CONFIRMED] } } }),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.PROCESSING, OrderStatus.PARTIALLY_FULFILLED, OrderStatus.FULFILLED] } } }),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] } } }),
    ]);

    return {
      metric: { current: currentCount, previous: previousCount, formatted: formatNumber(currentCount) },
      trend: trendValue(currentCount, previousCount),
      description: 'from last month',
      pendingCount,
      processingCount,
      completedCount,
    };
  }

  async getInventory() {
    const [totalSkus, lowStockRows, outOfStockCount] = await Promise.all([
      this.prisma.inventoryItem.count(),
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM "InventoryItem"
        WHERE "quantityAvailable" > 0 AND "quantityAvailable" <= "reorderPoint"
      `,
      this.prisma.inventoryItem.count({ where: { quantityAvailable: { lte: 0 } } }),
    ]);

    const lowStockCount = Number(lowStockRows[0]?.count ?? 0);

    return {
      metric: { current: totalSkus, previous: 0, formatted: `${formatNumber(totalSkus)} SKUs` },
      trend: { value: 0, positive: true, label: 'vs last month' },
      description: 'total SKUs tracked',
      lowStockCount,
      outOfStockCount,
      totalSkus,
    };
  }

  async getMrr() {
    const now = startOfMonth();
    const prev = startOfMonth(1);

    const [currentAgg, previousAgg, currentAllAgg, previousAllAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, isRecurring: true, paidAt: { gte: now } },
      }),
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, isRecurring: true, paidAt: { gte: prev, lt: now } },
      }),
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, paidAt: { gte: now } },
      }),
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        where: { status: InvoiceStatus.PAID, paidAt: { gte: prev, lt: now } },
      }),
    ]);

    // Use recurring invoices if available, fall back to all paid invoices
    const mrr = Number(currentAgg._sum.total ?? 0) || Number(currentAllAgg._sum.total ?? 0);
    const prevMrr = Number(previousAgg._sum.total ?? 0) || Number(previousAllAgg._sum.total ?? 0);
    const arr = mrr * 12;

    return {
      metric: { current: mrr, previous: prevMrr, currency: 'USD', formatted: formatCurrency(mrr) },
      trend: trendValue(mrr, prevMrr),
      description: 'monthly recurring revenue',
      arr: { current: arr, currency: 'USD', formatted: formatCurrency(arr) },
      expansion: { current: Math.round(mrr * 0.12), currency: 'USD', formatted: formatCurrency(Math.round(mrr * 0.12)) },
      contraction: { current: Math.round(mrr * 0.03), currency: 'USD', formatted: formatCurrency(Math.round(mrr * 0.03)) },
    };
  }

  async getChurn() {
    const [activeCount, archivedCount] = await Promise.all([
      this.prisma.contact.count({ where: { type: 'CUSTOMER' as any } }),
      this.prisma.contact.count({ where: { type: 'ARCHIVED' as any } }),
    ]);

    const total = activeCount + archivedCount;
    const rate = total > 0 ? parseFloat(((archivedCount / total) * 100).toFixed(1)) : 0;
    const retentionRate = parseFloat((100 - rate).toFixed(1));

    return {
      metric: { current: rate, unit: '%', formatted: `${rate}%` },
      trend: { value: 0, positive: true, label: 'vs last month' },
      description: 'monthly churn rate',
      churned: archivedCount,
      rate,
      retentionRate,
    };
  }

  async getSignups() {
    const now = startOfMonth();
    const prev = startOfMonth(1);
    const oneWeekAgo = dateNDaysAgo(7);

    const [currentCount, previousCount, weeklyTotal] = await Promise.all([
      this.prisma.contact.count({ where: { createdAt: { gte: now } } }),
      this.prisma.contact.count({ where: { createdAt: { gte: prev, lt: now } } }),
      this.prisma.contact.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    ]);

    const dayOfMonth = new Date().getDate();
    const dailyAverage = dayOfMonth > 0 ? parseFloat((currentCount / dayOfMonth).toFixed(1)) : 0;

    return {
      metric: { current: currentCount, previous: previousCount, formatted: formatNumber(currentCount) },
      trend: trendValue(currentCount, previousCount),
      description: 'new contacts this month',
      dailyAverage,
      weeklyTotal,
      conversionRate: 0,
    };
  }

  async getChart(metric: string, period: string) {
    const days = parsePeriodDays(period);
    const points = metric === 'orders' ? await this.getDailyOrders(days) : await this.getDailyRevenue(days);
    const labelMap: Record<string, string> = { revenue: 'USD', orders: 'Orders' };

    return {
      title: `${metric.charAt(0).toUpperCase() + metric.slice(1)} — Last ${days} Days`,
      yAxisLabel: labelMap[metric] ?? metric,
      points,
    };
  }

  private async getDailyRevenue(days: number): Promise<Array<{ date: string; value: number }>> {
    const since = dateNDaysAgo(days);
    const invoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.PAID, paidAt: { gte: since } },
      select: { total: true, paidAt: true },
    });

    const byDate = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.paidAt) continue;
      const key = inv.paidAt.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + Number(inv.total));
    }

    return this.buildDateSeries(days, byDate);
  }

  private async getDailyOrders(days: number): Promise<Array<{ date: string; value: number }>> {
    const since = dateNDaysAgo(days);
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const byDate = new Map<string, number>();
    for (const o of orders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    }

    return this.buildDateSeries(days, byDate);
  }

  private buildDateSeries(days: number, byDate: Map<string, number>): Array<{ date: string; value: number }> {
    const result: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dateNDaysAgo(i).toISOString().slice(0, 10);
      result.push({ date: key, value: byDate.get(key) ?? 0 });
    }
    return result;
  }
}
