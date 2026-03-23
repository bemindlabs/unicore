import { Controller, Get, Query } from '@nestjs/common';
import { ConversationsAnalyticsService } from './conversations-analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('api/v1/conversations/analytics')
export class ConversationsAnalyticsController {
  constructor(
    private readonly analyticsService: ConversationsAnalyticsService,
  ) {}

  @Get()
  async getAnalytics(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('scope') scope?: string,
  ) {
    // OWNER/OPERATOR can request global analytics; others see only conversations assigned to them
    const assigneeId =
      scope === 'all' &&
      (user.role === 'OWNER' || user.role === 'OPERATOR')
        ? undefined
        : user.id;

    return this.analyticsService.getAnalytics({
      assigneeId,
      from,
      to,
      days: days ? parseInt(days, 10) : undefined,
    });
  }
}
