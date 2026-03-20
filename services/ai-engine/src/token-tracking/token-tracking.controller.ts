import { Controller, Get, Query } from '@nestjs/common';
import { TokenTrackingService } from './token-tracking.service';
import type { UsagePeriod } from './token-tracking.service';

@Controller('usage')
export class TokenTrackingController {
  constructor(private readonly tokenTracking: TokenTrackingService) {}

  @Get('stats')
  stats(
    @Query('tenantId') tenantId?: string,
    @Query('agentId') agentId?: string,
    @Query('provider') provider?: string,
    @Query('since') since?: string,
  ) {
    return this.tokenTracking.getStats({
      tenantId,
      agentId,
      provider,
      since: since ? new Date(since) : undefined,
    });
  }

  /**
   * Aggregated usage analytics — daily/weekly/monthly cost tracking.
   *
   * GET /api/v1/usage/analytics?period=daily&from=2026-03-01&to=2026-03-20
   */
  @Get('analytics')
  analytics(
    @Query('period') period: string = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
    @Query('provider') provider?: string,
  ) {
    const validPeriods: UsagePeriod[] = ['daily', 'weekly', 'monthly'];
    const usagePeriod: UsagePeriod = validPeriods.includes(period as UsagePeriod)
      ? (period as UsagePeriod)
      : 'daily';

    return this.tokenTracking.getAggregatedUsage({
      period: usagePeriod,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      tenantId,
      provider,
    });
  }

  @Get('records')
  records(
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
  ) {
    return this.tokenTracking.getRecords(
      parseInt(limit, 10),
      parseInt(offset, 10),
    );
  }
}
