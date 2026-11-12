import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('revenue')
  getRevenue() {
    return this.dashboardService.getRevenue();
  }

  @Get('orders')
  getOrders() {
    return this.dashboardService.getOrders();
  }

  @Get('inventory')
  getInventory() {
    return this.dashboardService.getInventory();
  }

  @Get('mrr')
  getMrr() {
    return this.dashboardService.getMrr();
  }

  @Get('churn')
  getChurn() {
    return this.dashboardService.getChurn();
  }

  @Get('signups')
  getSignups() {
    return this.dashboardService.getSignups();
  }

  @Get('chart')
  getChart(
    @Query('metric') metric?: string | string[],
    @Query('period') period?: string | string[],
  ) {
    // Nest binds repeated query parameters to an array, and the service calls
    // string methods on both values (`metric.charAt`, `metric.slice`). Keep the
    // input a string so a duplicated parameter cannot change the type underneath
    // those calls.
    return this.dashboardService.getChart(
      typeof metric === 'string' ? metric : 'revenue',
      typeof period === 'string' ? period : '30d',
    );
  }
}
