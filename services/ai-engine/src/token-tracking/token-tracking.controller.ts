import { Controller, Get, Query } from '@nestjs/common';
import { TokenTrackingService } from './token-tracking.service';

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
