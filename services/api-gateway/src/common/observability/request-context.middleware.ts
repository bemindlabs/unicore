import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { runWithRequestContext } from './request-context';

/**
 * Assigns a per-request correlation id (GAPS #15) and opens the
 * request-context ALS scope for the rest of the request.
 *
 * Honors an inbound `X-Request-Id` (so a correlation id set by nginx/an
 * upstream gateway is preserved across hops) and otherwise mints a UUID. The id
 * is echoed back in the `X-Request-Id` response header (already whitelisted in
 * the CORS `exposedHeaders`) so clients can quote it in bug reports.
 *
 * Registered as the FIRST middleware so the id is available to every later
 * middleware, guard, interceptor and the structured logger. `userId` is filled
 * in later (post-auth) by the metrics interceptor via `setRequestUserId`.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers['x-request-id'];
    const requestId =
      (typeof inbound === 'string' && inbound.trim().length > 0
        ? inbound.trim()
        : undefined) ?? randomUUID();

    res.setHeader('X-Request-Id', requestId);
    (req as { requestId?: string }).requestId = requestId;

    runWithRequestContext({ requestId }, () => next());
  }
}
