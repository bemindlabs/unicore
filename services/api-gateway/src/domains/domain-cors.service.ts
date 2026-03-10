import { Injectable, Logger } from '@nestjs/common';
import type { DomainResolution } from './types/domain.types';

export interface CorsOptions {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

const DEFAULT_CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Tenant-Id',
];
const DEFAULT_EXPOSED_HEADERS = ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'];
const DEFAULT_CORS_MAX_AGE = 86_400; // 24 h

@Injectable()
export class DomainCorsService {
  private readonly logger = new Logger(DomainCorsService.name);

  /**
   * Build CORS options for a request given a resolved domain configuration.
   *
   * When `resolution` is null (platform / unknown domain) permissive defaults
   * are returned so that the gateway still responds correctly.
   */
  buildCorsOptions(
    requestOrigin: string | undefined,
    resolution: DomainResolution | null,
  ): CorsOptions {
    if (!resolution) {
      return this.defaultCorsOptions(requestOrigin);
    }

    const { allowedOrigins, hostname } = resolution;

    if (allowedOrigins.length === 0) {
      // Domain exists but has no explicit CORS config — allow the domain itself
      this.logger.debug(
        `No explicit CORS origins for ${hostname}; allowing same-origin only`,
      );
      return this.buildOptions([`https://${hostname}`, `http://${hostname}`]);
    }

    const originAllowed =
      requestOrigin !== undefined && this.isOriginAllowed(requestOrigin, allowedOrigins);

    if (requestOrigin && !originAllowed) {
      this.logger.warn(
        `CORS origin "${requestOrigin}" rejected for domain ${hostname}`,
      );
    }

    return this.buildOptions(allowedOrigins, originAllowed ? requestOrigin : false);
  }

  /**
   * Check whether a specific origin is present in the allowed list.
   * Supports exact matches and wildcard subdomain patterns (e.g. "*.acme.com").
   */
  isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    for (const allowed of allowedOrigins) {
      if (allowed === origin) return true;
      if (allowed === '*') return true;

      // Wildcard subdomain pattern: "*.example.com"
      if (allowed.startsWith('*.')) {
        const baseDomain = allowed.slice(2);
        try {
          const originUrl = new URL(origin);
          if (
            originUrl.hostname === baseDomain ||
            originUrl.hostname.endsWith(`.${baseDomain}`)
          ) {
            return true;
          }
        } catch {
          // Not a valid URL — skip wildcard match
        }
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private defaultCorsOptions(requestOrigin: string | undefined): CorsOptions {
    return {
      origin: requestOrigin ?? false,
      methods: DEFAULT_CORS_METHODS,
      allowedHeaders: DEFAULT_ALLOWED_HEADERS,
      exposedHeaders: DEFAULT_EXPOSED_HEADERS,
      credentials: true,
      maxAge: DEFAULT_CORS_MAX_AGE,
    };
  }

  private buildOptions(
    allowedOrigins: string[],
    resolvedOrigin?: string | false,
  ): CorsOptions {
    return {
      origin: resolvedOrigin !== undefined ? resolvedOrigin : allowedOrigins,
      methods: DEFAULT_CORS_METHODS,
      allowedHeaders: DEFAULT_ALLOWED_HEADERS,
      exposedHeaders: DEFAULT_EXPOSED_HEADERS,
      credentials: true,
      maxAge: DEFAULT_CORS_MAX_AGE,
    };
  }
}
