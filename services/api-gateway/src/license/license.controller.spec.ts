import { Test, TestingModule } from '@nestjs/testing';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import type { LicenseStatus } from './interfaces/license.interface';

const now = new Date('2026-03-10T00:00:00.000Z');
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const mockProStatus: LicenseStatus = {
  valid: true,
  edition: 'pro',
  key: 'UC-PRO-KEY',
  features: ['fullRbac', 'sso'],
  expiresAt: null,
  validatedAt: now,
  nextRevalidationAt: nextWeek,
};

const mockLicenseService = {
  getLicenseStatus: jest.fn().mockResolvedValue(mockProStatus),
  activate: jest.fn().mockResolvedValue(mockProStatus),
  revalidate: jest.fn().mockResolvedValue(mockProStatus),
  activateAddon: jest.fn().mockResolvedValue(undefined),
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
    mockLicenseService.activate.mockResolvedValue(mockProStatus);
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
        edition: 'pro',
        tier: 'pro',
        features: ['fullRbac', 'sso'],
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

  describe('activate', () => {
    it('calls licenseService.activate with the provided key', async () => {
      const result = await controller.activate({ key: 'UC-NEW-KEY' }, undefined as any, { user: { email: 'test@test.com' } } as any);

      expect(mockLicenseService.activate).toHaveBeenCalledTimes(1);
      expect(mockLicenseService.activate).toHaveBeenCalledWith('UC-NEW-KEY');
      expect(result.valid).toBe(true);
      expect(result.edition).toBe('pro');
    });

    it('returns status with validatedAt but without the raw key', async () => {
      const result = await controller.activate({ key: 'UC-NEW-KEY' }, undefined as any, { user: { email: 'test@test.com' } } as any);

      expect(result).toHaveProperty('validatedAt');
      expect(result).not.toHaveProperty('key');
    });
  });

  describe('revalidate', () => {
    it('calls licenseService.revalidate and returns updated status', async () => {
      const result = await controller.revalidate();

      expect(mockLicenseService.revalidate).toHaveBeenCalledTimes(1);
      expect(result.valid).toBe(true);
      expect(result.edition).toBe('pro');
      expect(result.validatedAt).toEqual(now);
    });

    it('includes validatedAt in revalidate response', async () => {
      const result = await controller.revalidate();
      expect(result).toHaveProperty('validatedAt');
    });
  });
});
