import { Injectable, Logger, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { MinimalRedisClient } from '../domains/redis-client';
import type {
  LicenseStatus,
  LicenseTier,
  ProFeature,
  LicenseValidationResponse,
} from './interfaces/license.interface';

/** One week in milliseconds — cache TTL for license status. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Features available per tier.
 * Community tier has no Pro features.
 * Enterprise tier is a superset of Pro.
 */
/**
 * Features available per tier — camelCase names aligned with
 * @unicore-license/license-types FeatureFlags.
 */
const TIER_FEATURES: Record<LicenseTier, ProFeature[]> = {
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
 * Validation results are cached locally with a weekly revalidation window so
 * the application keeps working even when the license server is temporarily
 * unreachable.
 *
 * Cache is in-memory; for multi-replica deployments a Redis-backed cache
 * should replace it (tracked as a follow-up task).
 */
const REDIS_LICENSE_KEY = 'unicore:license:active_key';

/** Map env-var edition names to license tiers. */
const EDITION_TO_TIER: Record<string, LicenseTier> = {
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

  /** Cached license status — null until first validation completes. */
  private cachedStatus: LicenseStatus | null = null;

  /** Promise guard to avoid concurrent validation races on startup. */
  private validationInFlight: Promise<LicenseStatus> | null = null;

  /**
   * The license-validated effective edition. All feature flag checks must use
   * this instead of reading UNICORE_EDITION from the environment directly.
   * Prevents bypassing license enforcement by setting env vars alone.
   */
  private effectiveEdition: LicenseTier = 'community';

  /**
   * Lifecycle hook — runs once when the module is initialised.
   *
   * 1. Connects to Redis and restores any previously-activated license key.
   * 2. If UNICORE_LICENSE_KEY is set (or a key was restored from Redis),
   *    validates it eagerly so tier/features are known before the first
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
    } catch (err) {
      this.logger.warn(
        `Could not connect to Redis for license persistence: ${(err as Error).message}. ` +
          'Activated keys will not survive restarts.',
      );
    }

    // Validate license on startup if a key is available
    const key = this.getKey();
    if (key) {
      try {
        const status = await this.getLicenseStatus();
        this.logger.log(
          `Startup license check: tier=${status.tier} valid=${status.valid}`,
        );
      } catch (err) {
        this.logger.warn(
          `Startup license validation failed: ${(err as Error).message}. ` +
            'Continuing with community defaults.',
        );
      }
    } else {
      this.logger.log(
        'No UNICORE_LICENSE_KEY configured — starting in Community tier',
      );
    }

    // Enforce: env-claimed edition must match license tier.
    // If UNICORE_EDITION claims 'full'/'pro' but the license says 'community',
    // override to 'community' to prevent env-only bypass.
    const envEdition = process.env.UNICORE_EDITION ?? 'community';
    const licenseTier = this.cachedStatus?.tier ?? 'community';
    this.effectiveEdition = licenseTier;

    const envClaimedTier = EDITION_TO_TIER[envEdition] ?? 'community';
    if (envClaimedTier !== licenseTier) {
      this.logger.warn(
        `Edition mismatch: env claimed "${envEdition}" (${envClaimedTier}) but license tier is "${licenseTier}". ` +
          `Overriding to "${licenseTier}".`,
      );
    }

    this.logger.log(`License tier: ${licenseTier} (env claimed: ${envEdition})`);
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
   * Will trigger validation if the cache is empty or stale.
   */
  async getLicenseStatus(): Promise<LicenseStatus> {
    if (this.cachedStatus && !this.isCacheStale(this.cachedStatus)) {
      return this.cachedStatus;
    }

    // Deduplicate concurrent callers
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
  getEffectiveEdition(): LicenseTier {
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
   * Validates that the current agent count is within the tier limit.
   * Throws ForbiddenException when the limit has been reached.
   *
   * Tier limits:
   *   - Community: 2 agents
   *   - Pro: 50 agents
   *   - Enterprise: 999 agents
   */
  async checkAgentLimit(currentCount: number): Promise<void> {
    const status = await this.getLicenseStatus();
    const maxAgents =
      status.tier === 'enterprise' ? 999 : status.tier === 'pro' ? 50 : 2;
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
    this.cachedStatus = null;

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
    this.cachedStatus = null;
    return this.getLicenseStatus();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isCacheStale(status: LicenseStatus): boolean {
    return Date.now() - status.validatedAt.getTime() > CACHE_TTL_MS;
  }

  private async validate(): Promise<LicenseStatus> {
    const key = this.getKey();

    if (!key) {
      this.logger.log('No UNICORE_LICENSE_KEY set — running in Community tier');
      return this.buildCommunityStatus(null);
    }

    try {
      const result = await this.callLicenseServer(key);
      const status = this.buildStatusFromResponse(key, result);
      this.cachedStatus = status;
      this.effectiveEdition = status.tier;

      this.logger.log(
        `License validated: tier=${status.tier} features=[${status.features.join(', ')}]`,
      );

      return status;
    } catch (err) {
      this.logger.warn(
        `License server unreachable: ${(err as Error).message}. ` +
          `Falling back to ${this.cachedStatus ? 'cached' : 'community'} status.`,
      );

      // If we have a still-valid (but potentially stale) cache entry, preserve it
      // so the application keeps working during transient network outages.
      if (this.cachedStatus) {
        return this.cachedStatus;
      }

      return this.buildCommunityStatus(key);
    }
  }

  /**
   * Calls the UniCore License Server REST API.
   *
   * SECURITY: The license server URL is hardcoded to prevent spoofing via
   * environment variable override. An attacker who controls
   * UNICORE_LICENSE_SERVER_URL could point it at a fake server that always
   * returns valid=true, bypassing all license enforcement. Only allow
   * override in NODE_ENV=development for local testing.
   *
   * @throws {Error} when the HTTP request fails or returns a non-2xx status.
   */
  private async callLicenseServer(
    key: string,
  ): Promise<LicenseValidationResponse> {
    const baseUrl =
      process.env.NODE_ENV === 'development' && process.env.UNICORE_LICENSE_SERVER_URL
        ? process.env.UNICORE_LICENSE_SERVER_URL
        : 'https://license.unicore.io';

    const url = `${baseUrl}/v1/validate`;

    // Using the native fetch available in Node 18+ (ES2022 target).
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'unicore-api-gateway/1.0',
      },
      body: JSON.stringify({ key }),
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

    const responseTier = response.tier || response.edition;
    const tier: LicenseTier = (['pro', 'enterprise'] as LicenseTier[]).includes(
      responseTier as LicenseTier,
    )
      ? (responseTier as LicenseTier)
      : 'community';

    // License server returns features as object { allAgents: true, ... }
    // Convert to ProFeature[] array for internal use, fall back to tier defaults.
    let features: ProFeature[];
    if (Array.isArray(response.features)) {
      features = response.features.length > 0 ? response.features as ProFeature[] : TIER_FEATURES[tier];
    } else if (response.features && typeof response.features === 'object') {
      features = (Object.entries(response.features) as [string, boolean][])
        .filter(([, enabled]) => enabled)
        .map(([name]) => name as ProFeature);
      if (features.length === 0) features = TIER_FEATURES[tier];
    } else {
      features = TIER_FEATURES[tier];
    }

    return {
      valid: true,
      tier,
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
      tier: 'community',
      key,
      features: TIER_FEATURES.community,
      expiresAt: null,
      validatedAt: now,
      nextRevalidationAt: new Date(now.getTime() + CACHE_TTL_MS),
    };
  }
}
