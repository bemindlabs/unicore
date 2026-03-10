import {
  Injectable,
  NestMiddleware,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitStore } from './rate-limit.store';

export interface RateLimitConfig {
  /** Maximum requests per window per key */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const USER_LIMIT: RateLimitConfig = {
  maxRequests: parseInt(process.env.RATE_LIMIT_USER_MAX ?? '200', 10),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10), // 1 minute
};

const IP_LIMIT: RateLimitConfig = {
  maxRequests: parseInt(process.env.RATE_LIMIT_IP_MAX ?? '100', 10),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10), // 1 minute
};

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first.split(',')[0]!.trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(private readonly store: RateLimitStore) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ip = getClientIp(req);
    const ipKey = `ip:${ip}`;
    const ipResult = this.store.increment(ipKey, IP_LIMIT.windowMs);

    if (ipResult.count > IP_LIMIT.maxRequests) {
      this.logger.warn(
        `IP rate limit exceeded: ${ip} (${ipResult.count}/${IP_LIMIT.maxRequests})`,
      );
      res
        .status(HttpStatus.TOO_MANY_REQUESTS)
        .setHeader('Retry-After', String(Math.ceil(ipResult.resetInMs / 1000)))
        .setHeader('X-RateLimit-Limit', String(IP_LIMIT.maxRequests))
        .setHeader('X-RateLimit-Remaining', '0')
        .setHeader(
          'X-RateLimit-Reset',
          String(Math.ceil(ipResult.resetAt / 1000)),
        )
        .json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests from this IP. Please retry later.',
          retryAfterSeconds: Math.ceil(ipResult.resetInMs / 1000),
        });
      return;
    }

    res.setHeader('X-RateLimit-Limit', String(IP_LIMIT.maxRequests));
    res.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, IP_LIMIT.maxRequests - ipResult.count)),
    );
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(ipResult.resetAt / 1000)),
    );

    // Per-user rate limiting (only applies when JWT is present in request headers)
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      // We extract the user sub from the JWT payload (without verifying — the
      // JwtAuthGuard already guards the route; here we just need the key).
      const token = authHeader.slice(7);
      const userId = extractUserIdFromToken(token);

      if (userId) {
        const userKey = `user:${userId}`;
        const userResult = this.store.increment(userKey, USER_LIMIT.windowMs);

        if (userResult.count > USER_LIMIT.maxRequests) {
          this.logger.warn(
            `User rate limit exceeded: ${userId} (${userResult.count}/${USER_LIMIT.maxRequests})`,
          );
          res
            .status(HttpStatus.TOO_MANY_REQUESTS)
            .setHeader(
              'Retry-After',
              String(Math.ceil(userResult.resetInMs / 1000)),
            )
            .setHeader('X-RateLimit-User-Limit', String(USER_LIMIT.maxRequests))
            .setHeader('X-RateLimit-User-Remaining', '0')
            .json({
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message: 'User request quota exceeded. Please retry later.',
              retryAfterSeconds: Math.ceil(userResult.resetInMs / 1000),
            });
          return;
        }

        res.setHeader('X-RateLimit-User-Limit', String(USER_LIMIT.maxRequests));
        res.setHeader(
          'X-RateLimit-User-Remaining',
          String(Math.max(0, USER_LIMIT.maxRequests - userResult.count)),
        );
        res.setHeader(
          'X-RateLimit-User-Reset',
          String(Math.ceil(userResult.resetAt / 1000)),
        );
      }
    }

    next();
  }
}

/**
 * Decode the JWT payload to extract `sub` (user id) without verification.
 * The guard already validates the signature — here we only need the key.
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8'),
    ) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
