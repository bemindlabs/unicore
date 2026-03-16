import { Injectable, Logger } from '@nestjs/common';
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
const TIER_FEATURES: Record<LicenseTier, ProFeature[]> = {
  community: [],
  pro: [
    'advanced_agents',
    'rbac',
    'sso',
    'audit_log',
    'multi_channel',
    'priority_support',
    'custom_integrations',
  ],
  enterprise: [
    'advanced_agents',
    'rbac',
    'sso',
    'audit_log',
    'multi_channel',
    'white_label',
    'priority_support',
    'custom_integrations',
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
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  /** The active license key. Falls back to env var when null. */
  private licenseKey: string | null = null;

  /** Cached license status — null until first validation completes. */
  private cachedStatus: LicenseStatus | null = null;

  /** Promise guard to avoid concurrent validation races on startup. */
  private validationInFlight: Promise<LicenseStatus> | null = null;

  /**
   * Returns the current license key, preferring the in-memory value
   * and falling back to the environment variable.
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
   * Activates a new license key by storing it in-memory and immediately
   * validating it against the license server.
   */
  async activate(key: string): Promise<LicenseStatus> {
    this.licenseKey = key;
    this.cachedStatus = null;
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
   * The license server base URL defaults to the well-known production endpoint
   * but can be overridden via UNICORE_LICENSE_SERVER_URL for on-premise
   * deployments or testing.
   *
   * @throws {Error} when the HTTP request fails or returns a non-2xx status.
   */
  private async callLicenseServer(
    key: string,
  ): Promise<LicenseValidationResponse> {
    const baseUrl =
      process.env.UNICORE_LICENSE_SERVER_URL ?? 'https://license.unicore.io';

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

    const tier: LicenseTier = (['pro', 'enterprise'] as LicenseTier[]).includes(
      response.tier,
    )
      ? response.tier
      : 'community';

    // Server may return a custom feature list; fall back to tier defaults.
    const features: ProFeature[] =
      response.features.length > 0 ? response.features : TIER_FEATURES[tier];

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
