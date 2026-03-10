import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RevenueReport {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  currency: string;
}

export interface ExpenseSummary {
  category: string;
  totalAmount: number;
  count: number;
}

export interface InventoryReport {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export interface DashboardSummary {
  revenue: { thisMonth: number; lastMonth: number; growth: number };
  orders: { pending: number; processing: number; fulfilled: number };
  invoices: { draft: number; sent: number; overdue: number; paid: number };
  expenses: { pending: number; approved: number; totalThisMonth: number };
  contacts: { total: number; leads: number; customers: number };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getRevenueSummary(from: Date, to: Date, currency = 'USD'): Promise<RevenueReport> {
    const orders = await this.prisma.order.findMany({
      where: { status: 'FULFILLED', fulfilledAt: { gte: from, lte: to }, currency },
      select: { total: true },
    });
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    return {
      period: `${from.toISOString().split('T')[0]} to ${to.toISOString().split('T')[0]}`,
      totalRevenue, totalOrders, averageOrderValue, currency,
    };
  }

  async getExpenseSummaryByCategory(from: Date, to: Date): Promise<ExpenseSummary[]> {
    const grouped = await this.prisma.expense.groupBy({
      by: ['category'],
      where: { status: { in: ['APPROVED', 'REIMBURSED'] }, createdAt: { gte: from, lte: to } },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    return grouped.map((g) => ({
      category: g.category,
      totalAmount: Number(g._sum.amount ?? 0),
      count: g._count.id,
    }));
  }

  async getInventoryReport(): Promise<InventoryReport> {
    const [totalProducts, lowStockResult, outOfStockProducts, totalValue] =
      await this.prisma.$transaction([
        this.prisma.product.count(),
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count FROM "Product"
          WHERE quantity > 0 AND quantity <= "lowStockThreshold"
        `,
        this.prisma.product.count({ where: { quantity: 0 } }),
        this.prisma.product.aggregate({ _sum: { costPrice: true } }),
      ]);
    return {
      totalProducts,
      totalValue: Number(totalValue._sum.costPrice ?? 0),
      lowStockCount: Number((lowStockResult as { count: bigint }[])[0]?.count ?? 0),
      outOfStockCount: outOfStockProducts,
    };
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      pendingOrders, processingOrders, fulfilledOrders,
      draftInvoices, sentInvoices, overdueInvoices, paidInvoices,
      pendingExpenses, approvedExpenses, thisMonthExpenses,
      totalContacts, leadContacts, customerContacts,
      thisMonthRevenue, lastMonthRevenue,
    ] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED'] } } }),
      this.prisma.order.count({ where: { status: 'FULFILLED' } }),
      this.prisma.invoice.count({ where: { status: 'DRAFT' } }),
      this.prisma.invoice.count({ where: { status: 'SENT' } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      this.prisma.invoice.count({ where: { status: 'PAID' } }),
      this.prisma.expense.count({ where: { status: 'PENDING' } }),
      this.prisma.expense.count({ where: { status: 'APPROVED' } }),
      this.prisma.expense.aggregate({
        where: { status: { in: ['APPROVED', 'REIMBURSED'] }, createdAt: { gte: thisMonthStart } },
        _sum: { amount: true },
      }),
      this.prisma.contact.count(),
      this.prisma.contact.count({ where: { type: 'LEAD' } }),
      this.prisma.contact.count({ where: { type: 'CUSTOMER' } }),
      this.prisma.order.aggregate({
        where: { status: 'FULFILLED', fulfilledAt: { gte: thisMonthStart } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({
        where: { status: 'FULFILLED', fulfilledAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum: { total: true },
      }),
    ]);

    const thisMonthRev = Number(thisMonthRevenue._sum.total ?? 0);
    const lastMonthRev = Number(lastMonthRevenue._sum.total ?? 0);
    const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;

    return {
      revenue: { thisMonth: thisMonthRev, lastMonth: lastMonthRev, growth: Math.round(growth * 100) / 100 },
      orders: { pending: pendingOrders, processing: processingOrders, fulfilled: fulfilledOrders },
      invoices: { draft: draftInvoices, sent: sentInvoices, overdue: overdueInvoices, paid: paidInvoices },
      expenses: {
        pending: pendingExpenses, approved: approvedExpenses,
        totalThisMonth: Number(thisMonthExpenses._sum.amount ?? 0),
      },
      contacts: { total: totalContacts, leads: leadContacts, customers: customerContacts },
    };
  }

  async getTopProducts(limit = 10) {
    const result = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'sku'],
      where: { order: { status: 'FULFILLED' } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });
    return result.map((r) => ({
      productId: r.productId,
      name: r.productName,
      sku: r.sku,
      totalSold: r._sum.quantity ?? 0,
      totalRevenue: Number(r._sum.totalPrice ?? 0),
    }));
  }

  async getTopContacts(limit = 10) {
    const result = await this.prisma.order.groupBy({
      by: ['contactId'],
      where: { status: 'FULFILLED' },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });
    const contactIds = result.map((r) => r.contactId);
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const contactMap = new Map(contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`]));
    return result.map((r) => ({
      contactId: r.contactId,
      name: contactMap.get(r.contactId) ?? 'Unknown',
      totalOrders: r._count.id,
      totalRevenue: Number(r._sum.total ?? 0),
    }));
  }
}
