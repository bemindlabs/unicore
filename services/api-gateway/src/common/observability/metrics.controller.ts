import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { MetricsAccessGuard } from './metrics-access.guard';
import { Public } from '../../auth/decorators/public.decorator';

/**
 * Prometheus scrape endpoint (GAPS #15).
 *
 * GATING (the safe option): the route is `@Public()` only so the global
 * JwtAuthGuard does not bounce a token-less scraper, but `MetricsAccessGuard`
 * then restricts access to the internal trust channel — the request must carry
 * a whitelisted `x-internal-service` header (the same header the gateway already
 * validates for service-to-service calls). A Prometheus scraper reaches
 * `/metrics` over the internal network with that header; external/tenant traffic
 * is rejected with 403. This keeps process- and tenant-level metrics off the
 * public surface without standing up a separate metrics port.
 */
@ApiExcludeController()
@Controller('metrics')
@Public()
@UseGuards(MetricsAccessGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res({ passthrough: true }) res: Response): Promise<string> {
    res.setHeader('Content-Type', this.metrics.contentType);
    return this.metrics.render();
  }
}
