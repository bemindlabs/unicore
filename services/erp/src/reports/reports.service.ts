import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, OrderStatus, InvoiceStatus, ExpenseStatus } from '../generated/prisma';

/** Validates an IANA timezone string (e.g. "Asia/Bangkok", "America/New_York"). */
const IANA_TZ_RE = /^[A-Za-z_]+\/[A-Za-z_\/]+$/;

export function isValidTimezone(tz: string): boolean {
  if (tz === 'UTC') return true;
  if (!IANA_TZ_RE.test(tz)) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a local date string (YYYY-MM-DD) to a UTC Date
 * representing the start of that day in the given timezone.
 *
 * E.g. toTzDate('2025-03-01', 'Asia/Bangkok') → 2025-02-28T17:00:00.000Z
 */
export function toTzDate(dateStr: string, timezone: string): Date {
  const utcDate = new Date(dateStr + 'T00:00:00Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const localAtUtcMidnight = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`,
  );
  const offsetMs = localAtUtcMidnight.getTime() - utcDate.getTime();
  return new Date(utcDate.getTime() - offsetMs);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves the effective timezone, falling back to env or UTC. */
  resolveTimezone(tz?: string): string {
    if (tz && isValidTimezone(tz)) return tz;
    const envTz = process.env.BUSINESS_TIMEZONE;
    if (envTz && isValidTimezone(envTz)) return envTz;
    return 'UTC';
  }

  async getDashboardSummary() {
    const [
      totalContacts, totalOrders, pendingOrders, totalProducts,
      lowStockCount, totalInvoices, unpaidInvoices, totalExpenses, pendingExpenses,
    ] = await Promise.all([
      this.prisma.contact.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } } }),
      this.prisma.product.count(),
      this.prisma.inventoryItem.count({ where: { quantityAvailable: { lte: 0 } } }),
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } } }),
      this.prisma.expense.count(),
      this.prisma.expense.count({ where: { status: ExpenseStatus.SUBMITTED } }),
    ]);

    const [revenueAgg, expenseAgg] = await Promise.all([
      this.prisma.invoice.aggregate({ _sum: { total: true }, where: { status: InvoiceStatus.PAID } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { status: { in: [ExpenseStatus.APPROVED, ExpenseStatus.REIMBURSED] } } }),
    ]);

    return {
      contacts: { total: totalContacts },
      orders: { total: totalOrders, pending: pendingOrders },
      inventory: { totalProducts, lowStockCount },
      invoices: { total: totalInvoices, unpaid: unpaidInvoices, totalRevenue: revenueAgg._sum.total ?? 0 },
      expenses: { total: totalExpenses, pending: pendingExpenses, totalAmount: expenseAgg._sum.amount ?? 0 },
    };
  }

  async getRevenueSummary(from?: string, to?: string, timezone?: string) {
    const tz = this.resolveTimezone(timezone);
    const where: any = { status: InvoiceStatus.PAID };
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = toTzDate(from, tz);
      if (to) {
        const endOfDay = new Date(toTzDate(to, tz).getTime() + 86_400_000 - 1);
        where.paidAt.lte = endOfDay;
      }
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: { total: true, currency: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    });

    const byCurrency: Record<string, number> = {};
    for (const inv of invoices) {
      byCurrency[inv.currency] = (byCurrency[inv.currency] ?? 0) + Number(inv.total);
    }

    return { invoices: invoices.length, byCurrency, from, to, timezone: tz };
  }

  async getExpenseSummaryByCategory(from?: string, to?: string, timezone?: string) {
    const tz = this.resolveTimezone(timezone);
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = toTzDate(from, tz);
      if (to) {
        const endOfDay = new Date(toTzDate(to, tz).getTime() + 86_400_000 - 1);
        where.createdAt.lte = endOfDay;
      }
    }

    const groups = await this.prisma.expense.groupBy({
      by: ['category', 'status'],
      _sum: { amount: true },
      _count: true,
      where,
    });

    return groups;
  }

  async getInventoryReport() {
    const products = await this.prisma.product.findMany({
      select: { id: true, sku: true, name: true, category: true, unitPrice: true, costPrice: true },
      orderBy: { name: 'asc' },
    });

    const inventoryItems = await this.prisma.inventoryItem.findMany({
      include: { product: { select: { costPrice: true } } },
    });

    const totalUnits = inventoryItems.reduce((sum, item) => sum + item.quantityOnHand, 0);
    const lowStock = inventoryItems.filter(item => item.quantityAvailable <= item.reorderPoint);
    const totalInventoryValue = inventoryItems.reduce(
      (sum, item) => sum + item.quantityOnHand * Number(item.product.costPrice), 0,
    );

    return {
      totalProducts: products.length,
      totalUnits,
      totalInventoryValue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    };
  }

  async getTopProducts(limit = 10) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId', 'sku', 'name'],
      _sum: { quantity: true, lineTotal: true },
      _count: true,
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });
    return items;
  }

  async getTopContacts(limit = 10) {
    const contacts = await this.prisma.contact.findMany({
      take: limit,
      orderBy: { leadScore: 'desc' },
      select: {
        id: true, name: true, email: true, company: true,
        leadScore: true, type: true,
        _count: { select: { orders: true, invoices: true } },
      },
    });
    return contacts;
  }

  /**
   * Timezone-aware monthly P&L report.
   * Uses PostgreSQL AT TIME ZONE to bucket dates in the business timezone
   * instead of UTC.
   */
  async getMonthlyPnl(timezone?: string) {
    const tz = this.resolveTimezone(timezone);

    const rows = await this.prisma.$queryRaw<
      Array<{ month: string; currency: string; totalRevenue: number; totalExpenses: number; grossProfit: number }>
    >(Prisma.sql`
      WITH revenue AS (
        SELECT
          to_char(date_trunc('month', "paidAt" AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
          currency,
          COALESCE(SUM(total), 0) AS total_revenue
        FROM "Invoice"
        WHERE status = 'PAID' AND "paidAt" IS NOT NULL
        GROUP BY 1, 2
      ),
      expenses AS (
        SELECT
          to_char(date_trunc('month', "expenseDate" AT TIME ZONE ${tz}), 'YYYY-MM') AS month,
          currency,
          COALESCE(SUM(COALESCE("baseAmount", amount)), 0) AS total_expenses
        FROM "Expense"
        WHERE status = 'APPROVED'
        GROUP BY 1, 2
      ),
      months AS (
        SELECT month, currency FROM revenue
        UNION
        SELECT month, currency FROM expenses
      )
      SELECT
        m.month,
        m.currency,
        COALESCE(r.total_revenue, 0)::float  AS "totalRevenue",
        COALESCE(e.total_expenses, 0)::float AS "totalExpenses",
        (COALESCE(r.total_revenue, 0) - COALESCE(e.total_expenses, 0))::float AS "grossProfit"
      FROM months m
      LEFT JOIN revenue  r ON r.month = m.month AND r.currency = m.currency
      LEFT JOIN expenses e ON e.month = m.month AND e.currency = m.currency
      ORDER BY m.month DESC, m.currency
    `);

    return { timezone: tz, data: rows };
  }

  /**
   * Timezone-aware AR aging report.
   * Computes days overdue relative to the current date in the business timezone.
   */
  async getArAging(timezone?: string) {
    const tz = this.resolveTimezone(timezone);

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string; invoiceNumber: string; contactName: string;
        total: number; amountDue: number; daysOverdue: number; agingBucket: string;
      }>
    >(Prisma.sql`
      SELECT
        i.id,
        i."invoiceNumber",
        COALESCE(c.name, 'Unknown') AS "contactName",
        i.total::float,
        i."amountDue"::float AS "amountDue",
        GREATEST(0, EXTRACT(DAY FROM (
          (now() AT TIME ZONE ${tz})::date - (i."dueDate" AT TIME ZONE ${tz})::date
        ))::INT) AS "daysOverdue",
        CASE
          WHEN (now() AT TIME ZONE ${tz})::date <= (i."dueDate" AT TIME ZONE ${tz})::date
            THEN 'current'
          WHEN EXTRACT(DAY FROM ((now() AT TIME ZONE ${tz})::date - (i."dueDate" AT TIME ZONE ${tz})::date)) <= 30
            THEN '1-30'
          WHEN EXTRACT(DAY FROM ((now() AT TIME ZONE ${tz})::date - (i."dueDate" AT TIME ZONE ${tz})::date)) <= 60
            THEN '31-60'
          WHEN EXTRACT(DAY FROM ((now() AT TIME ZONE ${tz})::date - (i."dueDate" AT TIME ZONE ${tz})::date)) <= 90
            THEN '61-90'
          ELSE '90+'
        END AS "agingBucket"
      FROM "Invoice" i
      LEFT JOIN "Contact" c ON c.id = i."contactId"
      WHERE i."amountDue" > 0
        AND i.status NOT IN ('VOID', 'WRITTEN_OFF', 'DRAFT')
    `);

    return { timezone: tz, data: rows };
  }
}
