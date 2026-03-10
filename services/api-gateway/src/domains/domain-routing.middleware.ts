import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { DomainResolverService } from './domain-resolver.service';
import { DomainCorsService } from './domain-cors.service';
import type { DomainResolution } from './types/domain.types';

/** Augment the Express Request type to carry domain resolution context. */
declare module 'express' {
  interface Request {
    /** Set by DomainRoutingMiddleware when the host resolves to a custom domain tenant. */
    tenantId?: string;
    /** Full domain resolution result — available to downstream guards/controllers. */
    domainResolution?: DomainResolution;
  }
}

@Injectable()
export class DomainRoutingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DomainRoutingMiddleware.name);

  constructor(
    private readonly resolver: DomainResolverService,
    private readonly corsService: DomainCorsService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawHost = (req.headers['host'] as string | undefined) ?? '';

    if (!rawHost) {
      this.logger.warn('Request received without a Host header; using default routing');
      next();
      return;
    }

    let resolution: DomainResolution | null = null;

    try {
      resolution = await this.resolver.resolve(rawHost);
    } catch (err) {
      this.logger.error(
        `Domain resolution error for host "${rawHost}": ${(err as Error).message}`,
      );
      // Non-fatal — fall back to default routing
    }

    if (resolution) {
      req.tenantId = resolution.tenantId;
      req.domainResolution = resolution;
      res.setHeader('X-Tenant-Id', resolution.tenantId);
    }

    // Apply per-domain CORS headers
    this.applyCorsHeaders(req, res, resolution);

    next();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private applyCorsHeaders(
    req: Request,
    res: Response,
    resolution: DomainResolution | null,
  ): void {
    const requestOrigin = req.headers['origin'] as string | undefined;

    const corsOptions = this.corsService.buildCorsOptions(requestOrigin, resolution);

    const originHeader =
      typeof corsOptions.origin === 'string'
        ? corsOptions.origin
        : corsOptions.origin === true
          ? requestOrigin ?? ''
          : corsOptions.origin === false
            ? ''
            : Array.isArray(corsOptions.origin)
              ? (requestOrigin && this.corsService.isOriginAllowed(requestOrigin, corsOptions.origin as string[])
                  ? requestOrigin
                  : '')
              : '';

    if (originHeader) {
      res.setHeader('Access-Control-Allow-Origin', originHeader);
    }

    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Allow-Credentials', String(corsOptions.credentials));
    res.setHeader('Access-Control-Max-Age', String(corsOptions.maxAge));

    // Handle preflight short-circuit
    if (req.method === 'OPTIONS') {
      res.status(204).end();
    }
  }
}
