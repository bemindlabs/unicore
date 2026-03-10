/**
 * Resolved domain information including the tenant it belongs to.
 */
export interface DomainResolution {
  /** The normalized hostname that was resolved (e.g. "app.acme.com") */
  hostname: string;
  /** UUID of the tenant that owns this custom domain */
  tenantId: string;
  /** Allowed CORS origins from the domain config */
  allowedOrigins: string[];
  /** Whether the domain has been verified (DNS validated) */
  isVerified: boolean;
  /** ISO timestamp of when the domain record was last updated */
  updatedAt: string;
}

/**
 * Entry stored/retrieved from the Redis domain cache.
 */
export interface DomainCacheEntry {
  tenantId: string;
  allowedOrigins: string[];
  isVerified: boolean;
  updatedAt: string;
  /** Unix epoch (ms) when this entry was cached — used for TTL audit logs */
  cachedAt: number;
}

/**
 * Configuration for the domain routing layer, consumed from env vars.
 */
export interface DomainRoutingConfig {
  /** Hostnames that are treated as the default platform domain and bypassed. */
  platformDomains: string[];
  /** Redis key TTL in seconds for cached domain→tenant mappings (default 300). */
  cacheTtlSeconds: number;
  /** Redis key prefix for domain cache entries. */
  cacheKeyPrefix: string;
}
