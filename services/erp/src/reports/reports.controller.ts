import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('erp/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard() {
    return this.reportsService.getDashboardSummary();
  }

  @Get('revenue')
  getRevenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getRevenueSummary(from, to);
  }

  @Get('expenses/categories')
  getExpensesByCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getExpenseSummaryByCategory(from, to);
  }

  @Get('inventory')
  getInventory() {
    return this.reportsService.getInventoryReport();
  }

  @Get('products/top')
  getTopProducts(@Query('limit') limit?: string) {
    return this.reportsService.getTopProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('contacts/top')
  getTopContacts(@Query('limit') limit?: string) {
    return this.reportsService.getTopContacts(limit ? parseInt(limit, 10) : 10);
  }
}
