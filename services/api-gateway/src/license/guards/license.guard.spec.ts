import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { LicenseGuard } from './license.guard';
import { LicenseService } from '../license.service';
import { PRO_FEATURE_KEY } from '../decorators/pro-feature.decorator';
import type { LicenseStatus } from '../interfaces/license.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// exported to suppress noUnusedLocals — available for future test cases
export function buildProStatus(): LicenseStatus {
  const now = new Date();
  return {
    valid: true,
    tier: 'pro',
    key: 'UC-PRO-KEY',
    features: ['fullRbac', 'sso', 'auditLogs', 'allAgents'],
    expiresAt: null,
    validatedAt: now,
    nextRevalidationAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

function buildCommunityStatus(): LicenseStatus {
  const now = new Date();
  return {
    valid: true,
    tier: 'community',
    key: null,
    features: [],
    expiresAt: null,
    validatedAt: now,
    nextRevalidationAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

function mockExecutionContext(featureMetadata?: string): ExecutionContext {
  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({}),
    }),
    _featureMetadata: featureMetadata, // used by the reflector mock below
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LicenseGuard', () => {
  let guard: LicenseGuard;
  let reflector: Reflector;
  let licenseService: jest.Mocked<Pick<LicenseService, 'hasFeature' | 'getLicenseStatus'>>;

  beforeEach(async () => {
    licenseService = {
      hasFeature: jest.fn(),
      getLicenseStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseGuard,
        Reflector,
        { provide: LicenseService, useValue: licenseService },
      ],
    }).compile();

    guard = module.get<LicenseGuard>(LicenseGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows request when no ProFeatureRequired metadata is set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const ctx = mockExecutionContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(licenseService.hasFeature).not.toHaveBeenCalled();
  });

  it('allows request when feature is included in active license', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('fullRbac');
    licenseService.hasFeature.mockResolvedValue(true);
    const ctx = mockExecutionContext('fullRbac');

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(licenseService.hasFeature).toHaveBeenCalledWith('fullRbac');
  });

  it('throws ForbiddenException when feature is not in license', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('whiteLabelBranding');
    licenseService.hasFeature.mockResolvedValue(false);
    licenseService.getLicenseStatus.mockResolvedValue(buildCommunityStatus());
    const ctx = mockExecutionContext('whiteLabelBranding');

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Pro or Enterprise/);
  });

  it('includes the current tier in the ForbiddenException message', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('sso');
    licenseService.hasFeature.mockResolvedValue(false);
    licenseService.getLicenseStatus.mockResolvedValue(buildCommunityStatus());
    const ctx = mockExecutionContext('sso');

    await expect(guard.canActivate(ctx)).rejects.toThrow(/community/);
  });

  it('checks the correct PRO_FEATURE_KEY metadata key', async () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(undefined);

    const ctx = mockExecutionContext();
    await guard.canActivate(ctx);

    expect(spy).toHaveBeenCalledWith(
      PRO_FEATURE_KEY,
      expect.any(Array),
    );
  });

  it('allows all pro features when license is pro tier', async () => {
    const proFeatures = ['allAgents', 'fullRbac', 'sso', 'auditLogs'] as const;

    for (const feature of proFeatures) {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(feature);
      licenseService.hasFeature.mockResolvedValue(true);

      const ctx = mockExecutionContext(feature);
      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    }
  });
});
