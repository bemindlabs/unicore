import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';
import { setRequestUserId } from './request-context';
import { getTenantId } from '../tenancy/tenant-store';
import { DEMO_TENANT_ID } from '../tenancy/tenancy.config';

/**
 * Records HTTP + per-tenant metrics for every request (GAPS #15).
 *
 * Runs as a global interceptor. It late-binds `userId` into the request context
 * (auth has resolved `req.user` by interceptor time, so the structured logger
 * can correlate by user) and, on completion, feeds `MetricsService` the request
 * duration/count and a per-tenant counter increment that mirrors the
 * `TenantUsageService` billable-call source.
 *
 * Routes are labelled by their Express ROUTE TEMPLATE (e.g. `/users/:id`), never
 * the raw URL, to keep Prometheus label cardinality bounded.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = process.hrtime.bigint();

    const user = (req as { user?: { id?: string } }).user;
    if (user?.id) {
      setRequestUserId(user.id);
    }

    const record = () => {
      const durationSeconds =
        Number(process.hrtime.bigint() - start) / 1e9;
      const route = this.routeOf(req);
      this.metrics.observeHttp(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
      );

      // Per-tenant billable-call counter — only count real tenants (skip the
      // demo/bootstrap tenant, matching the usage-counter guard's exemption).
      const tenantId = getTenantId();
      if (tenantId && tenantId !== DEMO_TENANT_ID) {
        this.metrics.recordTenantCall(tenantId);
      }
    };

    return next.handle().pipe(
      tap({ next: record, error: record }),
    );
  }

  private routeOf(req: Request): string {
    const path = (req as { route?: { path?: string } }).route?.path;
    if (path) {
      const base = (req as { baseUrl?: string }).baseUrl ?? '';
      return (base + path) || path;
    }
    return req.path || 'unknown';
  }
}
