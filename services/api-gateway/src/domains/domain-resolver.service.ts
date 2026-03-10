import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainCacheService } from './domain-cache.service';
import type { DomainResolution, DomainCacheEntry } from './types/domain.types';

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  /** Hostnames that belong to the platform itself — resolved inline, never from DB. */
  private readonly platformDomains: ReadonlySet<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DomainCacheService,
  ) {
    const raw = (process.env.PLATFORM_DOMAINS ?? 'localhost,unicore.io')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    this.platformDomains = new Set(raw);
  }

  /**
   * Resolve a hostname to a DomainResolution.
   *
   * Lookup order:
   *   1. Platform domain bypass  → returns null (caller uses default routing)
   *   2. Redis cache hit          → returns cached resolution
   *   3. Database lookup          → caches result and returns it
   *   4. Unknown host             → logs warning, returns null (fallback)
   */
  async resolve(rawHost: string): Promise<DomainResolution | null> {
    const hostname = this.normalizeHostname(rawHost);

    if (this.isPlatformDomain(hostname)) {
      this.logger.debug(`Platform domain bypass: ${hostname}`);
      return null;
    }

    // Cache hit
    const cached = await this.cache.get(hostname);
    if (cached) {
      this.logger.debug(`Cache hit for ${hostname} → tenant ${cached.tenantId}`);
      return this.fromCacheEntry(hostname, cached);
    }

    // Database lookup
    const domain = await this.lookupInDatabase(hostname);

    if (!domain) {
      this.logger.warn(
        `Unknown host "${hostname}" — falling back to default platform routing`,
      );
      return null;
    }

    // Populate cache
    const entry: DomainCacheEntry = {
      tenantId: domain.tenantId,
      allowedOrigins: domain.allowedOrigins,
      isVerified: domain.isVerified,
      updatedAt: domain.updatedAt.toISOString(),
      cachedAt: Date.now(),
    };
    await this.cache.set(hostname, entry);

    this.logger.debug(`DB hit for ${hostname} → tenant ${domain.tenantId}`);

    return {
      hostname,
      tenantId: domain.tenantId,
      allowedOrigins: domain.allowedOrigins,
      isVerified: domain.isVerified,
      updatedAt: domain.updatedAt.toISOString(),
    };
  }

  /**
   * Check whether a hostname belongs to the platform (bypass list).
   */
  isPlatformDomain(hostname: string): boolean {
    const normalized = this.normalizeHostname(hostname);
    if (this.platformDomains.has(normalized)) return true;

    // Also match subdomains of platform domains, e.g. *.unicore.io
    for (const platform of this.platformDomains) {
      if (normalized.endsWith(`.${platform}`)) return true;
    }
    return false;
  }

  /**
   * Strip port from the Host header value and lower-case the result.
   */
  normalizeHostname(host: string): string {
    // Remove port suffix if present (e.g. "example.com:3000" → "example.com")
    return host.split(':')[0]!.toLowerCase().trim();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async lookupInDatabase(hostname: string): Promise<{
    tenantId: string;
    allowedOrigins: string[];
    isVerified: boolean;
    updatedAt: Date;
  } | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const domain = await (this.prisma as any).customDomain.findUnique({
        where: { hostname },
        select: {
          tenantId: true,
          allowedOrigins: true,
          isVerified: true,
          updatedAt: true,
        },
      });
      return domain ?? null;
    } catch (err) {
      this.logger.error(
        `Database error while resolving domain "${hostname}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  private fromCacheEntry(hostname: string, entry: DomainCacheEntry): DomainResolution {
    return {
      hostname,
      tenantId: entry.tenantId,
      allowedOrigins: entry.allowedOrigins,
      isVerified: entry.isVerified,
      updatedAt: entry.updatedAt,
    };
  }
}
