import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Request-scoped tenant-context middleware (SaaS phase 4.2).
 *
 * UniCore is always multi-tenant SaaS: the trusted tenant is resolved from the
 * JWT `tid` claim (jwt.strategy attaches the user's tenantId); the custom-domain
 * DomainRoutingMiddleware may also have set `req.tenantId` already. This
 * middleware never injects a default tenant — a request with no resolvable
 * tenant fails closed at auth.
 *
 * Any client-supplied `x-tenant-id` request header is stripped here so it can
 * never influence routing or be forwarded verbatim (fail-closed; the trusted
 * value is re-injected at the proxy layer).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // Never trust an inbound x-tenant-id from clients.
    delete (req.headers as Record<string, unknown>)['x-tenant-id'];

    next();
  }
}
