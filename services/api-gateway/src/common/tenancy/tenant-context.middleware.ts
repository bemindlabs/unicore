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
 *
 * EXCEPTION (GAPS #1): trusted service-to-service calls — identified by the
 * whitelisted `x-internal-service` header — MAY carry an `x-tenant-id`. These
 * are downstream services (ai-engine, rag, …) calling back into the gateway
 * (e.g. GET /settings/ai-config/keys) on behalf of a specific tenant, where the
 * tenant was already injected by the trusted proxy layer. Stripping it for those
 * calls would silently collapse every per-tenant key/secret read to the DEMO
 * tenant, defeating the per-tenant Settings isolation. External clients never set
 * `x-internal-service` (the gateway validates it against a whitelist), so this
 * does not reopen the spoofing hole.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    // Trust an inbound x-tenant-id ONLY on internal service-to-service calls;
    // strip it for every external/client request (fail-closed).
    if (!req.headers['x-internal-service']) {
      delete (req.headers as Record<string, unknown>)['x-tenant-id'];
    }

    next();
  }
}
