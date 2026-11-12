import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_TENANT_ID,
  isValidTenantId,
  runWithTenant,
} from './tenant-context';

/**
 * Captures the trusted `x-tenant-id` header (forwarded by the api-gateway) into
 * the request-scoped tenant context (SaaS phase 4.5).
 *
 * ERP trusts the gateway for `x-tenant-id` exactly as it trusts `x-user-id`:
 * the gateway strips any client-supplied value and re-injects the trusted one.
 * If the header is missing or malformed we fall back to the default tenant —
 * in self-host that is the only tenant; in saas the RLS policy still fails
 * closed because the default tenant's rows are a distinct partition.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers['x-tenant-id'];
    const raw = Array.isArray(header) ? header[0] : header;
    const tenantId = isValidTenantId(raw) ? raw : DEFAULT_TENANT_ID;
    runWithTenant(tenantId, () => next());
  }
}
