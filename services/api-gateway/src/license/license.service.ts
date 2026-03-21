import { Injectable, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { hostname, networkInterfaces, cpus } from 'os';
import { MinimalRedisClient } from '../domains/redis-client';
import type {
  LicenseStatus,
  LicenseEdition,
  ProFeature,
  LicenseValidationResponse,
} from './interfaces/license.interface';

/** 24 hours in milliseconds — offline grace period for license status cache. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 30 seconds — local in-memory cache TTL to avoid Redis round-trips on every request. */
const LOCAL_CACHE_TTL_MS = 30 * 1000;

/** Redis key for the cached license status (JSON-serialised LicenseStatus). */
const REDIS_LICENSE_STATUS_KEY = 'unicore:license:status';


/**
 * Features available per edition — camelCase names aligned with
 * @unicore-license/license-types FeatureFlags.
 */
const EDITION_FEATURES: Record<LicenseEdition, ProFeature[]> = {
  community: [
    'auditLogs',
  ],
  pro: [
    'allAgents',
    'customAgentBuilder',
    'fullRbac',
    'advancedWorkflows',
    'allChannels',
    'unlimitedRag',
    'sso',
    'auditLogs',
    'prioritySupport',
  ],
  enterprise: [
    'allAgents',
    'customAgentBuilder',
    'fullRbac',
    'advancedWorkflows',
    'allChannels',
    'unlimitedRag',
    'whiteLabelBranding',
    'sso',
    'auditLogs',
    'prioritySupport',
  ],
};

/**
 * LicenseService manages the license key and validates it against the UniCore
 * License Server. The license key is stored in-memory and falls back to the
 * UNICORE_LICENSE_KEY environment variable on first boot.
 *
 * Validation results are cached in Redis (shared across replicas) with a
 * 30-second local in-memory cache on top to avoid Redis round-trips on every
 * request. The Redis cache has a 24-hour TTL (offline grace period).
 *
 * License revocation is handled by deleting the Redis cache key; the 30-second
 * local cache ensures all replicas pick up the revocation promptly.
 */
const REDIS_LICENSE_KEY = 'unicore:license:active_key';

/** Map env-var edition names to license editions. */
const EDITION_MAP: Record<string, LicenseEdition> = {
  full: 'enterprise',
  pro: 'pro',
  community: 'community',
};

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);

  /** Redis client for persisting the activated license key across restarts. */
  private redis: MinimalRedisClient | null = null;
  private redisConnected = false;

  /** The active license key. Falls back to env var when null. */
  private licenseKey: string | null = null;

  /**
   * Local in-memory cache (30s TTL) sitting in front of Redis to avoid
   * a Redis round-trip on every request. Null until first validation.
   */
  private localCache: LicenseStatus | null = null;
  private localCacheSetAt = 0;

  /** Promise guard to avoid concurrent validation races on startup. */
  private validationInFlight: Promise<LicenseStatus> | null = null;

  /**
   * The license-validated effective edition. All feature flag checks must use
   * this instead of reading UNICORE_EDITION from the environment directly.
   * Prevents bypassing license enforcement by setting env vars alone.
   */
  private effectiveEdition: LicenseEdition = 'community';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Lifecycle hook — runs once when the module is initialised.
   *
   * 1. Connects to Redis and restores any previously-activated license key.
   * 2. If UNICORE_LICENSE_KEY is set (or a key was restored from Redis),
   *    validates it eagerly so edition/features are known before the first
   *    request arrives.
   *
   * Failures are logged as warnings — the service still starts so the
   * community edition keeps working without a license server.
   */
  async onModuleInit(): Promise<void> {
    // Connect to Redis for license key persistence
    try {
      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
      this.redis = new MinimalRedisClient(redisUrl);
      await this.redis.connect();
      this.redisConnected = true;
      this.logger.log('Redis connected for license key persistence');

      // Restore previously-activated key from Redis
      const storedKey = await this.redis.get(REDIS_LICENSE_KEY);
      if (storedKey) {
        this.licenseKey = storedKey;
        this.logger.log('Restored activated license key from Redis');
      }

      // Clear Redis license status cache on startup to force fresh validation
      // before serving any Pro features.
      try {
        await this.redis.del(REDIS_LICENSE_STATUS_KEY);
      } catch {
        // Non-critical — validate() will just skip Redis read
      }

      // Revocation: when license is revoked externally, the Redis cache key
      // is deleted (via clearRedisCache or direct DEL). The 30-second local
      // cache ensures all replicas pick up the revocation within 30 seconds.
    } catch (err) {
      this.logger.warn(
        `Could not connect to Redis for license persistence: ${(err as Error).message}. ` +
          'Activated keys will not survive restarts.',
      );
    }

    // Clear local in-memory cache on startup to force fresh validation
    this.localCache = null;
    this.localCacheSetAt = 0;

    // Validate license on startup if a key is available
    const key = this.getKey();
    let startupEdition: LicenseEdition = 'community';
    if (key) {
      try {
        const status = await this.getLicenseStatus();
        startupEdition = status.edition;
        this.logger.log(
          `Startup license check: edition=${status.edition} valid=${status.valid}`,
        );
      } catch (err) {
        this.logger.warn(
          `Startup license validation failed: ${(err as Error).message}. ` +
            'Continuing with community defaults.',
        );
      }
    } else {
      this.logger.log(
        'No UNICORE_LICENSE_KEY configured — starting in Community edition',
      );
    }

    // Enforce: env-claimed edition must match license edition.
    // If UNICORE_EDITION claims 'full'/'pro' but the license says 'community',
    // override to 'community' to prevent env-only bypass.
    const envEdition = process.env.UNICORE_EDITION ?? 'community';
    const licenseEdition = startupEdition;
    this.effectiveEdition = licenseEdition;

    const envClaimedEdition = EDITION_MAP[envEdition] ?? 'community';
    if (envClaimedEdition !== licenseEdition) {
      this.logger.warn(
        `Edition mismatch: env claimed "${envEdition}" (${envClaimedEdition}) but license edition is "${licenseEdition}". ` +
          `Overriding to "${licenseEdition}".`,
      );
    }

    this.logger.log(`License edition: ${licenseEdition} (env claimed: ${envEdition})`);
  }

  /**
   * Returns the current license key, preferring the in-memory value,
   * then falling back to the environment variable.
   */
  private getKey(): string | null {
    return this.licenseKey ?? process.env.UNICORE_LICENSE_KEY ?? null;
  }

  /**
   * Returns the current license status.
   * Checks local memory cache (30s) → Redis cache (24h) → license server.
   */
  async getLicenseStatus(): Promise<LicenseStatus> {
    // 1. Check 30-second local in-memory cache
    if (
      this.localCache &&
      Date.now() - this.localCacheSetAt < LOCAL_CACHE_TTL_MS &&
      !this.isCacheStale(this.localCache)
    ) {
      return this.localCache;
    }

    // 2. Check Redis cache
    const redisStatus = await this.getFromRedisCache();
    if (redisStatus && !this.isCacheStale(redisStatus)) {
      this.setLocalCache(redisStatus);
      return redisStatus;
    }

    // 3. Validate against license server (deduplicate concurrent callers)
    if (this.validationInFlight) {
      return this.validationInFlight;
    }

    this.validationInFlight = this.validate().finally(() => {
      this.validationInFlight = null;
    });

    return this.validationInFlight;
  }

  /**
   * Returns true when the current license grants access to the given feature.
   */
  async hasFeature(feature: ProFeature): Promise<boolean> {
    const status = await this.getLicenseStatus();
    return status.valid && status.features.includes(feature);
  }

  /**
   * Returns the license-validated effective edition.
   * All feature flag checks must go through this method, not read
   * UNICORE_EDITION from the environment directly.
   */
  getEffectiveEdition(): LicenseEdition {
    return this.effectiveEdition;
  }

  /**
   * Checks whether a specific ENABLE_* feature flag is allowed by the license.
   * Maps env-var style feature names to ProFeature checks.
   */
  async isFeatureEnabled(envFlag: string): Promise<boolean> {
    const flagToFeature: Record<string, ProFeature> = {
      ENABLE_SSO: 'sso',
      ENABLE_WHITE_LABEL: 'whiteLabelBranding',
      ENABLE_ADVANCED_WORKFLOWS: 'advancedWorkflows',
      ENABLE_ALL_CHANNELS: 'allChannels',
      ENABLE_CUSTOM_DOMAINS: 'allChannels',
      ENABLE_ADVANCED_ANALYTICS: 'auditLogs',
      ENABLE_PRIORITY_SUPPORT: 'prioritySupport',
    };

    const feature = flagToFeature[envFlag];
    if (!feature) return true; // Unknown flags pass through

    return this.hasFeature(feature);
  }

  /**
   * Validates that the current agent count is within the edition limit.
   * Throws ForbiddenException when the limit has been reached.
   *
   * Edition limits:
   *   - Community: 2 agents
   *   - Pro: 50 agents
   *   - Enterprise: 999 agents
   */
  async checkAgentLimit(currentCount: number): Promise<void> {
    const status = await this.getLicenseStatus();
    const maxAgents =
      status.edition === 'enterprise' ? 999 : status.edition === 'pro' ? 50 : 2;
    if (currentCount >= maxAgents) {
      throw new ForbiddenException(
        `Agent limit reached (${maxAgents}). Upgrade to Pro for more agents.`,
      );
    }
  }

  /**
   * Activates a new license key by storing it in-memory and immediately
   * validating it against the license server.
   */
  async activate(key: string): Promise<LicenseStatus> {
    this.licenseKey = key;
    this.localCache = null;
    this.localCacheSetAt = 0;
    await this.clearRedisCache();

    // Persist to Redis so the key survives gateway restarts
    if (this.redis && this.redisConnected) {
      try {
        await this.redis.set(REDIS_LICENSE_KEY, key);
        this.logger.log('License key persisted to Redis');
      } catch (err) {
        this.logger.warn(
          `Failed to persist license key to Redis: ${(err as Error).message}`,
        );
      }
    }

    return this.getLicenseStatus();
  }

  /**
   * Forces an immediate re-validation, bypassing the cache TTL.
   * Useful after a license key change at runtime.
   */
  async revalidate(): Promise<LicenseStatus> {
    this.localCache = null;
    this.localCacheSetAt = 0;
    await this.clearRedisCache();
    return this.getLicenseStatus();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private setLocalCache(status: LicenseStatus): void {
    this.localCache = status;
    this.localCacheSetAt = Date.now();
  }

  private async getFromRedisCache(): Promise<LicenseStatus | null> {
    if (!this.redis || !this.redisConnected) return null;
    try {
      const raw = await this.redis.get(REDIS_LICENSE_STATUS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Restore Date objects from serialised JSON
      parsed.validatedAt = new Date(parsed.validatedAt);
      parsed.nextRevalidationAt = new Date(parsed.nextRevalidationAt);
      parsed.expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null;
      return parsed as LicenseStatus;
    } catch {
      return null;
    }
  }

  private async setRedisCache(status: LicenseStatus): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    try {
      const ttlSeconds = Math.ceil(CACHE_TTL_MS / 1000);
      await this.redis.set(
        REDIS_LICENSE_STATUS_KEY,
        JSON.stringify(status),
        { EX: ttlSeconds },
      );
    } catch (err) {
      this.logger.warn(`Failed to cache license status in Redis: ${(err as Error).message}`);
    }
  }

  private async clearRedisCache(): Promise<void> {
    if (!this.redis || !this.redisConnected) return;
    try {
      await this.redis.del(REDIS_LICENSE_STATUS_KEY);
    } catch {
      // Non-critical
    }
  }

  private isCacheStale(status: LicenseStatus): boolean {
    return Date.now() - status.validatedAt.getTime() > CACHE_TTL_MS;
  }

  private async validate(): Promise<LicenseStatus> {
    const key = this.getKey();

    if (!key) {
      this.logger.log('No UNICORE_LICENSE_KEY set — running in Community edition');
      return this.buildCommunityStatus(null);
    }

    try {
      const result = await this.callLicenseServer(key);
      const status = this.buildStatusFromResponse(key, result);
      this.setLocalCache(status);
      await this.setRedisCache(status);
      this.effectiveEdition = status.edition;

      this.logger.log(
        `License validated: edition=${status.edition} features=[${status.features.join(', ')}]`,
      );

      return status;
    } catch (err) {
      this.logger.warn(
        `License server unreachable: ${(err as Error).message}. ` +
          `Falling back to ${this.localCache ? 'cached' : 'community'} status.`,
      );

      // Try Redis cache as fallback during transient network outages
      const redisFallback = await this.getFromRedisCache();
      if (redisFallback) {
        this.setLocalCache(redisFallback);
        return redisFallback;
      }

      // If we have a local cache entry, preserve it
      if (this.localCache) {
        return this.localCache;
      }

      return this.buildCommunityStatus(key);
    }
  }

  /**
   * Calls the UniCore License Server REST API.
   *
   * The URL defaults to the internal Docker service (http://unicore-license-api:4600)
   * but can be overridden via the LICENSE_SERVER_URL environment variable for
   * on-premise deployments or local testing.
   *
   * @throws {Error} when the HTTP request fails or returns a non-2xx status.
   */
  private async callLicenseServer(
    key: string,
  ): Promise<LicenseValidationResponse> {
    const baseUrl = this.configService.get('LICENSE_SERVER_URL', 'http://unicore-license-api:4600');

    const url = `${baseUrl}/v1/validate`;

    // Build machine fingerprint from container environment (v1 scheme)
    const cpuId = cpus()[0]?.model || hostname();
    const ifaces = networkInterfaces();
    const macAddress = Object.values(ifaces)
      .flat()
      .find((i) => i && !i.internal && i.mac !== '00:00:00:00:00:00')?.mac || '02:42:ac:11:00:02';
    const diskId = hostname(); // container ID as stable disk identifier
    // v1 hash: SHA-256 of "cpuId|macAddress|diskId" (pipe-separated)
    const fingerprintHash = createHash('sha256')
      .update(`${cpuId}|${macAddress}|${diskId}`)
      .digest('hex');

    // Using the native fetch available in Node 18+ (ES2022 target).
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'unicore-api-gateway/1.0',
      },
      body: JSON.stringify({
        key,
        machineFingerprint: {
          cpuId,
          macAddress,
          diskId,
          hash: fingerprintHash,
        },
      }),
      signal: AbortSignal.timeout(10_000), // 10-second timeout
    });

    if (!response.ok) {
      throw new Error(`License server returned HTTP ${response.status}`);
    }

    return response.json() as Promise<LicenseValidationResponse>;
  }

  private buildStatusFromResponse(
    key: string,
    response: LicenseValidationResponse,
  ): LicenseStatus {
    const now = new Date();

    if (!response.valid) {
      this.logger.warn(`License key rejected by server: ${response.message}`);
      return this.buildCommunityStatus(key);
    }

    const responseEdition = response.edition ?? response.tier;
    const edition: LicenseEdition = (['pro', 'enterprise'] as LicenseEdition[]).includes(
      responseEdition as LicenseEdition,
    )
      ? (responseEdition as LicenseEdition)
      : 'community';

    // License server returns features as object { allAgents: true, ... }
    // Convert to ProFeature[] array for internal use, fall back to edition defaults.
    let features: ProFeature[];
    if (Array.isArray(response.features)) {
      features = response.features.length > 0 ? response.features as ProFeature[] : EDITION_FEATURES[edition];
    } else if (response.features && typeof response.features === 'object') {
      features = (Object.entries(response.features) as [string, boolean][])
        .filter(([, enabled]) => enabled)
        .map(([name]) => name as ProFeature);
      if (features.length === 0) features = EDITION_FEATURES[edition];
    } else {
      features = EDITION_FEATURES[edition];
    }

    return {
      valid: true,
      edition,
      key,
      features,
      expiresAt: response.expiresAt ? new Date(response.expiresAt) : null,
      validatedAt: now,
      nextRevalidationAt: new Date(now.getTime() + CACHE_TTL_MS),
    };
  }

  private buildCommunityStatus(key: string | null): LicenseStatus {
    const now = new Date();
    return {
      valid: !key, // key present but invalid → false; no key → true (community valid)
      edition: 'community',
      key,
      features: EDITION_FEATURES.community,
      expiresAt: null,
      validatedAt: now,
      nextRevalidationAt: new Date(now.getTime() + CACHE_TTL_MS),
    };
  }
}
