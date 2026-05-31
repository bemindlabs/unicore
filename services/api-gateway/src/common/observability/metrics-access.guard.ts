import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Access guard for the Prometheus `/metrics` scrape endpoint (GAPS #15).
 *
 * The endpoint is `@Public()` (so a token-less scraper is not bounced by the
 * global JwtAuthGuard), but exposure is restricted here to the internal trust
 * channel: the request MUST carry a whitelisted `x-internal-service` header —
 * the same header the gateway already validates for service-to-service calls
 * (see settings.controller.ts / super-admin.guard.ts). The scraper runs on the
 * internal network and sets this header; external/tenant traffic never does, so
 * process- and tenant-level metrics stay off the public surface without needing
 * a separate metrics port.
 */
@Injectable()
export class MetricsAccessGuard implements CanActivate {
  // Mirrors the service whitelist used elsewhere, plus the scraper itself.
  private static readonly ALLOWED = [
    'prometheus',
    'ai-engine',
    'rag',
    'openclaw-gateway',
    'workflow',
  ];

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers?.['x-internal-service'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value && MetricsAccessGuard.ALLOWED.includes(value)) {
      return true;
    }
    throw new ForbiddenException('Metrics endpoint is internal-only.');
  }
}
