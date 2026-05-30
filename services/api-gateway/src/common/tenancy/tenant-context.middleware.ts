import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { isSelfHost, DEFAULT_TENANT_ID } from './tenancy.config';

/**
 * Request-scoped tenant-context middleware (SaaS phase 4.2).
 *
 * Establishes a baseline `req.tenantId` before auth runs:
 *  - self-host : always the default tenant constant.
 *  - saas      : left to JWT resolution (jwt.strategy attaches the user's
 *                tenantId from the `tid` claim); the custom-domain
 *                DomainRoutingMiddleware may also have set it already.
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

    if (isSelfHost()) {
      req.tenantId = DEFAULT_TENANT_ID;
    }

    next();
  }
}
