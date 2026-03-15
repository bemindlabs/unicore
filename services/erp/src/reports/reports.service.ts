import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus, InvoiceStatus, ExpenseStatus } from '../generated/prisma';

@Injectable()
export class ReportsService {

  constructor(private readonly prisma: PrismaService) {}

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
}
