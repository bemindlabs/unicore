import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const mockReportsService = {
  getDashboardSummary: jest.fn(),
  getRevenueSummary: jest.fn(),
  getExpenseSummaryByCategory: jest.fn(),
  getInventoryReport: jest.fn(),
  getTopProducts: jest.fn(),
  getTopContacts: jest.fn(),
  getMonthlyPnl: jest.fn(),
  getArAging: jest.fn(),
};

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();
    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('getDashboard delegates to service', async () => {
    const summary = { contacts: { total: 10 }, orders: { total: 5, pending: 2 } };
    mockReportsService.getDashboardSummary.mockResolvedValue(summary);
    expect(await controller.getDashboard()).toBe(summary);
    expect(mockReportsService.getDashboardSummary).toHaveBeenCalled();
  });

  it('getRevenue delegates to service with query params', async () => {
    mockReportsService.getRevenueSummary.mockResolvedValue({ invoices: 5, byCurrency: {} });
    await controller.getRevenue('2025-01-01', '2025-01-31', 'Asia/Bangkok');
    expect(mockReportsService.getRevenueSummary).toHaveBeenCalledWith('2025-01-01', '2025-01-31', 'Asia/Bangkok');
  });

  it('getRevenue delegates to service without params', async () => {
    mockReportsService.getRevenueSummary.mockResolvedValue({ invoices: 0, byCurrency: {} });
    await controller.getRevenue(undefined, undefined, undefined);
    expect(mockReportsService.getRevenueSummary).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('getExpensesByCategory delegates to service', async () => {
    mockReportsService.getExpenseSummaryByCategory.mockResolvedValue([]);
    await controller.getExpensesByCategory('2025-01-01', '2025-01-31', 'UTC');
    expect(mockReportsService.getExpenseSummaryByCategory).toHaveBeenCalledWith('2025-01-01', '2025-01-31', 'UTC');
  });

  it('getInventory delegates to service', async () => {
    const report = { totalProducts: 10, totalUnits: 200 };
    mockReportsService.getInventoryReport.mockResolvedValue(report);
    expect(await controller.getInventory()).toBe(report);
    expect(mockReportsService.getInventoryReport).toHaveBeenCalled();
  });

  it('getTopProducts delegates to service with parsed limit', async () => {
    mockReportsService.getTopProducts.mockResolvedValue([]);
    await controller.getTopProducts('5');
    expect(mockReportsService.getTopProducts).toHaveBeenCalledWith(5);
  });

  it('getTopProducts delegates to service with default limit when not provided', async () => {
    mockReportsService.getTopProducts.mockResolvedValue([]);
    await controller.getTopProducts(undefined);
    expect(mockReportsService.getTopProducts).toHaveBeenCalledWith(10);
  });

  it('getTopContacts delegates to service with parsed limit', async () => {
    mockReportsService.getTopContacts.mockResolvedValue([]);
    await controller.getTopContacts('3');
    expect(mockReportsService.getTopContacts).toHaveBeenCalledWith(3);
  });

  it('getTopContacts delegates to service with default limit when not provided', async () => {
    mockReportsService.getTopContacts.mockResolvedValue([]);
    await controller.getTopContacts(undefined);
    expect(mockReportsService.getTopContacts).toHaveBeenCalledWith(10);
  });

  it('getMonthlyPnl delegates to service', async () => {
    mockReportsService.getMonthlyPnl.mockResolvedValue({ timezone: 'UTC', data: [] });
    await controller.getMonthlyPnl('UTC');
    expect(mockReportsService.getMonthlyPnl).toHaveBeenCalledWith('UTC');
  });

  it('getArAging delegates to service', async () => {
    mockReportsService.getArAging.mockResolvedValue({ timezone: 'UTC', data: [] });
    await controller.getArAging('America/New_York');
    expect(mockReportsService.getArAging).toHaveBeenCalledWith('America/New_York');
  });
});
