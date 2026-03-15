import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Public()
  @Get('api/v1/config/dashboard')
  getDashboardConfig() {
    return this.dashboardService.getDashboardConfig();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/revenue')
  getRevenueWidget() {
    return this.dashboardService.getRevenueWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/orders')
  getOrdersWidget() {
    return this.dashboardService.getOrdersWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/inventory')
  getInventoryWidget() {
    return this.dashboardService.getInventoryWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/mrr')
  getMrrWidget() {
    return this.dashboardService.getMrrWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/churn')
  getChurnWidget() {
    return this.dashboardService.getChurnWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/signups')
  getSignupsWidget() {
    return this.dashboardService.getSignupsWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/activity')
  getActivityWidget() {
    return this.dashboardService.getActivityWidget();
  }

  @Public()
  @Get('api/v1/dashboard/widgets/chart')
  getChartWidget(
    @Query('metric') metric?: string,
    @Query('period') period?: string,
  ) {
    return this.dashboardService.getChartWidget(metric ?? 'revenue', period ?? '30d');
  }
}
