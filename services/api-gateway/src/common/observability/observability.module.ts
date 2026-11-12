import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { StructuredLogger } from './structured-logger.service';
import { MetricsAccessGuard } from './metrics-access.guard';

/**
 * Lean observability module (GAPS #15): Prometheus `/metrics`, HTTP + per-tenant
 * metrics interceptor, and the shared `MetricsService`. The structured logger and
 * Sentry init are wired in `main.ts` (they must be in place before the app
 * factory / first log line), so they are not providers here.
 *
 * Global so the single `MetricsService` registry instance is shared everywhere.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    StructuredLogger,
    MetricsAccessGuard,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService, StructuredLogger],
})
export class ObservabilityModule {}
