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
    @Query('metric') metric = 'revenue',
    @Query('period') period = '30d',
  ) {
    return this.dashboardService.getChart(metric, period);
  }
}
