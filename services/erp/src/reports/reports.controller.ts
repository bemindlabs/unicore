import {
  Controller, Get, Query, ParseIntPipe,
} from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('erp/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard() { return this.reportsService.getDashboardSummary(); }

  @Get('revenue')
  getRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('currency') currency?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate = to ? new Date(to) : new Date();
    return this.reportsService.getRevenueSummary(fromDate, toDate, currency);
  }

  @Get('expenses')
  getExpenses(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(1));
    const toDate = to ? new Date(to) : new Date();
    return this.reportsService.getExpenseSummaryByCategory(fromDate, toDate);
  }

  @Get('inventory')
  getInventory() { return this.reportsService.getInventoryReport(); }

  @Get('top-products')
  getTopProducts(@Query('limit', new ParseIntPipe({ optional: true })) limit = 10) {
    return this.reportsService.getTopProducts(limit);
  }

  @Get('top-contacts')
  getTopContacts(@Query('limit', new ParseIntPipe({ optional: true })) limit = 10) {
    return this.reportsService.getTopContacts(limit);
  }
}
