import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  contact: { count: jest.fn(), findMany: jest.fn() },
  order: { count: jest.fn() },
  product: { count: jest.fn(), findMany: jest.fn() },
  inventoryItem: { count: jest.fn(), findMany: jest.fn() },
  invoice: { count: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
  expense: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
  orderItem: { groupBy: jest.fn() },
  $queryRaw: jest.fn(),
};

describe('ReportsService — dashboard and analytics', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getDashboardSummary', () => {
    beforeEach(() => {
      // 9 count calls + 2 aggregate calls
      mockPrisma.contact.count.mockResolvedValue(25);
      mockPrisma.order.count
        .mockResolvedValueOnce(100)  // totalOrders
        .mockResolvedValueOnce(12);  // pendingOrders
      mockPrisma.product.count.mockResolvedValue(50);
      mockPrisma.inventoryItem.count.mockResolvedValue(3);
      mockPrisma.invoice.count
        .mockResolvedValueOnce(200) // totalInvoices
        .mockResolvedValueOnce(15); // unpaidInvoices
      mockPrisma.expense.count
        .mockResolvedValueOnce(80)  // totalExpenses
        .mockResolvedValueOnce(5);  // pendingExpenses
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { total: 50000 } });
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 12000 } });
    });

    it('returns a structured dashboard summary', async () => {
      const result = await service.getDashboardSummary();

      expect(result.contacts.total).toBe(25);
      expect(result.orders.total).toBe(100);
      expect(result.orders.pending).toBe(12);
      expect(result.inventory.totalProducts).toBe(50);
      expect(result.inventory.lowStockCount).toBe(3);
      expect(result.invoices.total).toBe(200);
      expect(result.invoices.unpaid).toBe(15);
      expect(result.invoices.totalRevenue).toBe(50000);
      expect(result.expenses.total).toBe(80);
      expect(result.expenses.pending).toBe(5);
      expect(result.expenses.totalAmount).toBe(12000);
    });

    it('defaults revenue and expense totals to 0 when aggregate is null', async () => {
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { total: null } });
      mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const result = await service.getDashboardSummary();
      expect(result.invoices.totalRevenue).toBe(0);
      expect(result.expenses.totalAmount).toBe(0);
    });
  });

  describe('getExpenseSummaryByCategory', () => {
    it('returns expense groups by category', async () => {
      const groups = [
        { category: 'TRAVEL', status: 'APPROVED', _sum: { amount: 1500 }, _count: 3 },
        { category: 'MEALS', status: 'REIMBURSED', _sum: { amount: 300 }, _count: 5 },
      ];
      mockPrisma.expense.groupBy.mockResolvedValue(groups);

      const result = await service.getExpenseSummaryByCategory();
      expect(result).toEqual(groups);
      expect(mockPrisma.expense.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['category', 'status'] }),
      );
    });

    it('applies timezone-adjusted date filter when from/to provided', async () => {
      mockPrisma.expense.groupBy.mockResolvedValue([]);

      await service.getExpenseSummaryByCategory('2025-01-01', '2025-01-31', 'UTC');

      const call = mockPrisma.expense.groupBy.mock.calls[0][0];
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
      expect(call.where.createdAt.lte).toBeInstanceOf(Date);
    });

    it('returns all groups when no date range provided', async () => {
      mockPrisma.expense.groupBy.mockResolvedValue([]);

      await service.getExpenseSummaryByCategory();
      const call = mockPrisma.expense.groupBy.mock.calls[0][0];
      expect(call.where.createdAt).toBeUndefined();
    });
  });

  describe('getInventoryReport', () => {
    it('returns inventory statistics', async () => {
      const products = [
        { id: 'p1', sku: 'SKU1', name: 'Widget', category: 'Electronics', unitPrice: 50, costPrice: 30 },
      ];
      const inventoryItems = [
        {
          quantityOnHand: 100, quantityAvailable: 90, quantityReserved: 10,
          reorderPoint: 20, product: { costPrice: 30 },
        },
        {
          quantityOnHand: 5, quantityAvailable: 5, quantityReserved: 0,
          reorderPoint: 20, product: { costPrice: 10 },
        },
      ];
      mockPrisma.product.findMany.mockResolvedValue(products);
      mockPrisma.inventoryItem.findMany.mockResolvedValue(inventoryItems);

      const result = await service.getInventoryReport();

      expect(result.totalProducts).toBe(1);
      expect(result.totalUnits).toBe(105); // 100 + 5
      expect(result.totalInventoryValue).toBe(3050); // 100*30 + 5*10
      expect(result.lowStockCount).toBe(1); // only the second item (5 <= 20)
      expect(result.lowStockItems).toHaveLength(1);
    });

    it('returns zeros when inventory is empty', async () => {
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

      const result = await service.getInventoryReport();
      expect(result.totalUnits).toBe(0);
      expect(result.totalInventoryValue).toBe(0);
      expect(result.lowStockCount).toBe(0);
    });
  });

  describe('getTopProducts', () => {
    it('returns top products ordered by revenue', async () => {
      const items = [
        { productId: 'p1', sku: 'SKU1', name: 'Widget', _sum: { quantity: 50, lineTotal: 2500 }, _count: 10 },
      ];
      mockPrisma.orderItem.groupBy.mockResolvedValue(items);

      const result = await service.getTopProducts(10);
      expect(result).toEqual(items);
      expect(mockPrisma.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, by: ['productId', 'sku', 'name'] }),
      );
    });

    it('defaults limit to 10', async () => {
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      await service.getTopProducts();
      expect(mockPrisma.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('getTopContacts', () => {
    it('returns top contacts by lead score', async () => {
      const contacts = [
        { id: 'c1', name: 'Jane Doe', leadScore: 95, type: 'CUSTOMER', _count: { orders: 5, invoices: 3 } },
      ];
      mockPrisma.contact.findMany.mockResolvedValue(contacts);

      const result = await service.getTopContacts(5);
      expect(result).toEqual(contacts);
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, orderBy: { leadScore: 'desc' } }),
      );
    });

    it('defaults limit to 10', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      await service.getTopContacts();
      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });
});
