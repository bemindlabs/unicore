import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, InvoiceStatus, ExpenseStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary() {
    const [
      totalContacts, totalOrders, pendingOrders, totalProducts,
      lowStockCount, totalInvoices, unpaidInvoices, totalExpenses, pendingExpenses,
    ] = await Promise.all([
      this.prisma.contact.count(),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { quantity: { lte: 10 } } }),
      this.prisma.invoice.count(),
      this.prisma.invoice.count({ where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } } }),
      this.prisma.expense.count(),
      this.prisma.expense.count({ where: { status: ExpenseStatus.PENDING } }),
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

  async getRevenueSummary(from?: string, to?: string) {
    const where: any = { status: InvoiceStatus.PAID };
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to);
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

    return { invoices: invoices.length, byCurrency, from, to };
  }

  async getExpenseSummaryByCategory(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
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
    const [products, totalValue] = await Promise.all([
      this.prisma.product.findMany({
        select: { id: true, sku: true, name: true, category: true, quantity: true, reservedQuantity: true, lowStockThreshold: true, unitPrice: true, costPrice: true },
        orderBy: { quantity: 'asc' },
      }),
      this.prisma.product.aggregate({ _sum: { quantity: true } }),
    ]);

    const lowStock = products.filter(p => p.quantity <= p.lowStockThreshold);
    const totalInventoryValue = products.reduce((sum, p) => sum + p.quantity * Number(p.costPrice), 0);

    return {
      totalProducts: products.length,
      totalUnits: totalValue._sum.quantity ?? 0,
      totalInventoryValue,
      lowStockCount: lowStock.length,
      lowStockProducts: lowStock,
    };
  }

  async getTopProducts(limit = 10) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId', 'productName', 'sku'],
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });
    return items;
  }

  async getTopContacts(limit = 10) {
    const contacts = await this.prisma.contact.findMany({
      take: limit,
      orderBy: { leadScore: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, email: true, company: true,
        leadScore: true, type: true,
        _count: { select: { orders: true, invoices: true } },
      },
    });
    return contacts;
  }
}
