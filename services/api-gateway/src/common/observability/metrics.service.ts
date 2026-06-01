import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';

/**
 * Prometheus metrics registry for the gateway (GAPS #15).
 *
 * Exposes:
 *  - default process metrics (CPU, memory, event-loop lag, GC, …)
 *  - `http_request_duration_seconds` — histogram labelled by method/route/status
 *  - `http_requests_total` — counter labelled by method/route/status
 *  - `tenant_api_calls_total` — per-tenant billable-call counter, mirroring the
 *    same source `TenantUsageService` increments (so the Prometheus view and the
 *    Redis quota counter agree on what "an API call" is).
 *
 * Uses its OWN `Registry` instance (not the global default) so repeated module
 * instantiation in tests never throws the "metric already registered" error.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpDuration: Histogram<string>;
  readonly httpTotal: Counter<string>;
  readonly tenantApiCalls: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.tenantApiCalls = new Counter({
      name: 'tenant_api_calls_total',
      help: 'Total billable API calls per tenant',
      labelNames: ['tenant'],
      registers: [this.registry],
    });
  }

  /** Record one completed HTTP request. */
  observeHttp(
    method: string,
    route: string,
    status: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.httpDuration.observe(labels, durationSeconds);
    this.httpTotal.inc(labels);
  }

  /** Record one billable API call for a tenant (same source as usage counter). */
  recordTenantCall(tenantId: string): void {
    this.tenantApiCalls.inc({ tenant: tenantId });
  }

  /** Prometheus exposition text for the `/metrics` scrape. */
  async render(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
