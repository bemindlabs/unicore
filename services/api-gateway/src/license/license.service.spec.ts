import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from './license.service';
import type { LicenseValidationResponse } from './interfaces/license.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildValidProResponse(
  overrides: Partial<LicenseValidationResponse> = {},
): LicenseValidationResponse {
  return {
    valid: true,
    tier: 'pro',
    features: ['fullRbac', 'sso', 'auditLogs'],
    expiresAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LicenseService', () => {
  let service: LicenseService;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => process.env[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get<LicenseService>(LicenseService);

    // Reset internal cache between tests
    (service as any).localCache = null;
    (service as any).localCacheSetAt = 0;
    (service as any).validationInFlight = null;

    // Mock Redis cache methods (no Redis in unit tests)
    jest.spyOn(service as any, 'getFromRedisCache').mockResolvedValue(null);
    jest.spyOn(service as any, 'setRedisCache').mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Community tier (no key)
  // -------------------------------------------------------------------------

  describe('without UNICORE_LICENSE_KEY', () => {
    it('returns community tier with empty feature list', async () => {
      delete process.env.UNICORE_LICENSE_KEY;

      const status = await service.getLicenseStatus();

      expect(status.edition).toBe('community');
      expect(status.valid).toBe(true);
      expect(status.features).toEqual(['auditLogs']);
      expect(status.key).toBeNull();
    });

    it('hasFeature returns false for any pro feature', async () => {
      delete process.env.UNICORE_LICENSE_KEY;

      expect(await service.hasFeature('fullRbac')).toBe(false);
      expect(await service.hasFeature('sso')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Pro tier (valid key)
  // -------------------------------------------------------------------------

  describe('with a valid Pro license key', () => {
    beforeEach(() => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-VALID-KEY';

      jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse());
    });

    it('returns pro tier status', async () => {
      const status = await service.getLicenseStatus();

      expect(status.valid).toBe(true);
      expect(status.edition).toBe('pro');
      expect(status.key).toBe('UC-PRO-VALID-KEY');
    });

    it('populates features from server response', async () => {
      const status = await service.getLicenseStatus();

      expect(status.features).toEqual(['fullRbac', 'sso', 'auditLogs']);
    });

    it('hasFeature returns true for granted features', async () => {
      expect(await service.hasFeature('fullRbac')).toBe(true);
      expect(await service.hasFeature('sso')).toBe(true);
    });

    it('hasFeature returns false for features not in response', async () => {
      expect(await service.hasFeature('whiteLabelBranding')).toBe(false);
    });

    it('sets nextRevalidationAt approximately one day in the future', async () => {
      const before = Date.now();
      const status = await service.getLicenseStatus();
      const after = Date.now();

      const oneDayMs = 24 * 60 * 60 * 1000;
      const revalMs = status.nextRevalidationAt.getTime();

      expect(revalMs).toBeGreaterThanOrEqual(before + oneDayMs);
      expect(revalMs).toBeLessThanOrEqual(after + oneDayMs);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid / rejected key
  // -------------------------------------------------------------------------

  describe('with an invalid license key', () => {
    beforeEach(() => {
      process.env.UNICORE_LICENSE_KEY = 'UC-INVALID';

      jest.spyOn(service as any, 'callLicenseServer').mockResolvedValue({
        valid: false,
        tier: 'community',
        features: [],
        expiresAt: null,
        message: 'Key not found',
      } satisfies LicenseValidationResponse);
    });

    it('returns invalid community status', async () => {
      const status = await service.getLicenseStatus();

      expect(status.valid).toBe(false);
      expect(status.edition).toBe('community');
      expect(status.features).toEqual(['auditLogs']);
    });

    it('hasFeature returns false', async () => {
      expect(await service.hasFeature('fullRbac')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Cache behaviour
  // -------------------------------------------------------------------------

  describe('caching', () => {
    it('returns cached result on second call without re-validating', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-VALID-KEY';

      const spy = jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse());

      await service.getLicenseStatus();
      await service.getLicenseStatus();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('re-validates when cache is stale (past one week)', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-VALID-KEY';

      const spy = jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse());

      // First call populates the cache
      await service.getLicenseStatus();

      // Artificially expire the cache
      const oneWeekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      (service as any).localCache.validatedAt = oneWeekAgo;

      await service.getLicenseStatus();

      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('revalidate() bypasses cache', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-VALID-KEY';

      const spy = jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse());

      await service.getLicenseStatus(); // first call
      await service.revalidate(); // forced re-validation

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // License server unreachable — fallback behaviour
  // -------------------------------------------------------------------------

  describe('when license server is unreachable', () => {
    it('falls back to community tier when there is no cached status', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-KEY';

      jest
        .spyOn(service as any, 'callLicenseServer')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const status = await service.getLicenseStatus();

      expect(status.edition).toBe('community');
    });

    it('preserves stale cached status when server is unreachable', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-KEY';

      const spy = jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValueOnce(buildValidProResponse())
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      // First call succeeds
      const first = await service.getLicenseStatus();
      expect(first.tier).toBe('pro');

      // Expire cache
      (service as any).localCache.validatedAt = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      );

      // Second call — server fails but cached value is preserved
      const second = await service.getLicenseStatus();
      expect(second.tier).toBe('pro');
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Expiry date handling
  // -------------------------------------------------------------------------

  describe('license expiry', () => {
    it('parses expiresAt from server response', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-KEY';

      const expiresAt = '2027-01-01T00:00:00.000Z';
      jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse({ expiresAt }));

      const status = await service.getLicenseStatus();
      expect(status.expiresAt).toEqual(new Date(expiresAt));
    });

    it('sets expiresAt to null when not provided', async () => {
      process.env.UNICORE_LICENSE_KEY = 'UC-PRO-KEY';

      jest
        .spyOn(service as any, 'callLicenseServer')
        .mockResolvedValue(buildValidProResponse({ expiresAt: null }));

      const status = await service.getLicenseStatus();
      expect(status.expiresAt).toBeNull();
    });
  });
});
