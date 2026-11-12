import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { DEMO_TENANT_ID } from './tenancy.config';
import { isValidTenantId, runWithTenant } from './tenant-store';

/**
 * Seeds the request-scoped tenant store from the resolved tenant context
 * (SaaS phase 4.5). Runs as a global interceptor — after the JWT guard, so
 * `req.user.tenantId` (attached by jwt.strategy) is available. Falls back to
 * `req.tenantId` (set by the domain-routing middleware) and finally the
 * local/demo bootstrap tenant for unauthenticated/bootstrap paths.
 *
 * Wrapping the handler in {@link runWithTenant} makes the tenant id visible to
 * the gateway PrismaService so it can pin `SET LOCAL app.tenant_id` for queries
 * against the gateway's own tenant-scoped tables.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const fromUser = (req as { user?: { tenantId?: string } }).user?.tenantId;
    const fromReq = (req as { tenantId?: string }).tenantId;
    const candidate = fromUser ?? fromReq;
    const tenantId = isValidTenantId(candidate) ? candidate : DEMO_TENANT_ID;
    return runWithTenant(tenantId, () => next.handle());
  }
}
