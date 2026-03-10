import { Test, TestingModule } from '@nestjs/testing';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import type { LicenseStatus } from './interfaces/license.interface';

const now = new Date('2026-03-10T00:00:00.000Z');
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const mockProStatus: LicenseStatus = {
  valid: true,
  tier: 'pro',
  key: 'UC-PRO-KEY',
  features: ['rbac', 'sso'],
  expiresAt: null,
  validatedAt: now,
  nextRevalidationAt: nextWeek,
};

const mockLicenseService = {
  getLicenseStatus: jest.fn().mockResolvedValue(mockProStatus),
  revalidate: jest.fn().mockResolvedValue(mockProStatus),
};

describe('LicenseController', () => {
  let controller: LicenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicenseController],
      providers: [{ provide: LicenseService, useValue: mockLicenseService }],
    }).compile();

    controller = module.get<LicenseController>(LicenseController);
    jest.clearAllMocks();
    mockLicenseService.getLicenseStatus.mockResolvedValue(mockProStatus);
    mockLicenseService.revalidate.mockResolvedValue(mockProStatus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('returns license status without the raw key', async () => {
      const result = await controller.getStatus();

      expect(result).toEqual({
        valid: true,
        tier: 'pro',
        features: ['rbac', 'sso'],
        expiresAt: null,
        nextRevalidationAt: nextWeek,
      });
      // The raw key must NOT be exposed
      expect(result).not.toHaveProperty('key');
    });

    it('calls getLicenseStatus once', async () => {
      await controller.getStatus();
      expect(mockLicenseService.getLicenseStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('revalidate', () => {
    it('calls licenseService.revalidate and returns updated status', async () => {
      const result = await controller.revalidate();

      expect(mockLicenseService.revalidate).toHaveBeenCalledTimes(1);
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('pro');
      expect(result.validatedAt).toEqual(now);
    });

    it('includes validatedAt in revalidate response', async () => {
      const result = await controller.revalidate();
      expect(result).toHaveProperty('validatedAt');
    });
  });
});
