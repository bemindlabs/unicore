import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsController, TENANT_CONTEXT_PROVIDER } from './settings.controller';
import { PrismaService } from '../prisma/prisma.service';
import { LicenseService } from '../license/license.service';
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';
import { runWithTenant } from '../common/tenancy/tenant-store';
import * as fs from 'fs';

// Mock non-configurable fs methods so jest.spyOn can override them per test
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  lstatSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

// Set required encryption key before module load
const originalEncKey = process.env.SETTINGS_ENCRYPTION_KEY;
process.env.SETTINGS_ENCRYPTION_KEY = 'test-settings-enc-key-for-unit-tests-abc';

const mockPrismaService = {
  settings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    count: jest.fn(),
  },
};

afterAll(() => {
  if (originalEncKey === undefined) {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
  } else {
    process.env.SETTINGS_ENCRYPTION_KEY = originalEncKey;
  }
});

describe('SettingsController', () => {
  let controller: SettingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TENANT_CONTEXT_PROVIDER, useValue: null },
        {
          provide: LicenseService,
          useValue: {
            hasFeature: jest.fn().mockResolvedValue(true),
            getLicenseStatus: jest.fn().mockResolvedValue({ edition: 'community' }),
          },
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    jest.clearAllMocks();
  });

  // ── Wizard Status ──

  describe('getWizardStatus', () => {
    it('returns stored wizard data', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue({ data: { completed: true } });
      const result = await controller.getWizardStatus();
      expect(result).toEqual({ completed: true });
    });

    it('returns default when no record exists', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      const result = await controller.getWizardStatus();
      expect(result).toEqual({ completed: false });
    });
  });

  describe('setWizardStatus', () => {
    it('upserts wizard status and returns data', async () => {
      const dto = { completed: true, step: 3 } as any;
      mockPrismaService.settings.upsert.mockResolvedValue({ data: { completed: true, step: 3 } });

      const result = await controller.setWizardStatus(dto);

      expect(mockPrismaService.settings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_key: { tenantId: DEMO_TENANT_ID, key: 'wizard-status' } },
          create: expect.objectContaining({ key: 'wizard-status', tenantId: DEMO_TENANT_ID }),
          update: expect.any(Object),
        }),
      );
      expect(result).toEqual({ completed: true, step: 3 });
    });
  });

  // ── Branding ──

  describe('getBranding', () => {
    it('returns global branding config', async () => {
      const brandingData = { primaryColor: '#fff', logoUrl: '/logo.png' };
      mockPrismaService.settings.findUnique.mockResolvedValue({ data: brandingData });

      const result = await controller.getBranding();
      expect(result).toEqual(brandingData);
    });

    it('returns empty object when no branding configured', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      const result = await controller.getBranding();
      expect(result).toEqual({});
    });
  });

  describe('putBranding', () => {
    it('saves branding config and returns updated data', async () => {
      const dto = { primaryColor: '#000' } as any;
      mockPrismaService.settings.upsert.mockResolvedValue({ data: dto });

      const result = await controller.putBranding(dto);

      expect(mockPrismaService.settings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_key: { tenantId: DEMO_TENANT_ID, key: 'branding' } },
        }),
      );
      expect(result).toEqual(dto);
    });

    it('sanitizes dangerous CSS in customCss field', async () => {
      const dto = { customCss: '@import "evil.css"; .x { color: red; }' } as any;
      mockPrismaService.settings.upsert.mockResolvedValue({ data: dto });

      await controller.putBranding(dto);

      // The DTO customCss should have been sanitized (blocked @import replaced)
      expect(dto.customCss).toContain('/* blocked:@import */');
      expect(dto.customCss).not.toContain('@import "evil.css"');
    });

    it('passes through safe CSS without modification', async () => {
      const safeCss = '.button { color: blue; font-size: 14px; }';
      const dto = { customCss: safeCss } as any;
      mockPrismaService.settings.upsert.mockResolvedValue({ data: dto });

      await controller.putBranding(dto);

      expect(dto.customCss).toBe(safeCss);
    });
  });

  // ── serveBrandingFile (path traversal protection) ──

  describe('serveBrandingFile', () => {
    const mockRes = {
      setHeader: jest.fn(),
    } as any;

    it('rejects filenames with path separators', () => {
      expect(() => controller.serveBrandingFile('../../../etc/passwd', mockRes)).toThrow(BadRequestException);
    });

    it('rejects filenames with special characters', () => {
      expect(() => controller.serveBrandingFile('file;name.png', mockRes)).toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent valid filename', () => {
      jest.spyOn(fs, 'lstatSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => controller.serveBrandingFile('logo-123456789.png', mockRes)).toThrow(NotFoundException);
    });

    it('rejects symlinked files', () => {
      jest.spyOn(fs, 'lstatSync').mockReturnValue({
        isSymbolicLink: () => true,
      } as any);

      expect(() => controller.serveBrandingFile('logo-valid.png', mockRes)).toThrow(BadRequestException);
    });
  });

  // ── uploadBrandingFile ──

  describe('uploadBrandingFile', () => {
    it('throws BadRequestException when no file uploaded', async () => {
      await expect(
        controller.uploadBrandingFile(undefined as any, 'logo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid type parameter', async () => {
      const file = {
        originalname: 'logo.png',
        mimetype: 'image/png',
        filename: 'logo-123.png',
        path: '/uploads/branding/logo-123.png',
      } as any;

      await expect(
        controller.uploadBrandingFile(file, 'invalid-type'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when MIME type mismatches extension', async () => {
      const file = {
        originalname: 'logo.exe',
        mimetype: 'image/png',
        filename: 'logo-123.exe',
        path: '/uploads/branding/logo-123.exe',
      } as any;

      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      await expect(
        controller.uploadBrandingFile(file, 'logo'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns url for valid PNG upload', async () => {
      const file = {
        originalname: 'logo.png',
        mimetype: 'image/png',
        filename: 'logo-123456789.png',
        path: '/uploads/branding/logo-123456789.png',
      } as any;

      const result = await controller.uploadBrandingFile(file, 'logo');
      expect(result).toEqual({ url: '/api/v1/settings/branding/uploads/logo-123456789.png' });
    });

    it('accepts favicon type', async () => {
      const file = {
        originalname: 'favicon.ico',
        mimetype: 'image/x-icon',
        filename: 'favicon-123.ico',
        path: '/uploads/branding/favicon-123.ico',
      } as any;

      const result = await controller.uploadBrandingFile(file, 'favicon');
      expect(result.url).toContain('favicon-123.ico');
    });

    it('accepts logoIcon type', async () => {
      const file = {
        originalname: 'icon.svg',
        mimetype: 'image/svg+xml',
        filename: 'logoIcon-123.svg',
        path: '/uploads/branding/logoIcon-123.svg',
      } as any;

      const result = await controller.uploadBrandingFile(file, 'logoIcon');
      expect(result.url).toContain('logoIcon-123.svg');
    });
  });

  // ── Demo Status ──

  describe('getDemoStatus', () => {
    it('returns demoMode: false by default', () => {
      const savedDemoMode = process.env.DEMO_MODE;
      delete process.env.DEMO_MODE;
      const result = controller.getDemoStatus();
      expect(result).toEqual({ demoMode: false });
      if (savedDemoMode !== undefined) process.env.DEMO_MODE = savedDemoMode;
    });

    it('returns demoMode: true when DEMO_MODE=true', () => {
      const saved = process.env.DEMO_MODE;
      process.env.DEMO_MODE = 'true';
      const result = controller.getDemoStatus();
      expect(result).toEqual({ demoMode: true });
      process.env.DEMO_MODE = saved;
    });
  });

  // ── Team Count ──

  describe('getTeamCount', () => {
    it('returns the count of users', async () => {
      mockPrismaService.user.count.mockResolvedValue(5);
      const result = await controller.getTeamCount();
      expect(result).toEqual({ count: 5 });
    });
  });

  // ── AI Config ──

  describe('getAiConfig', () => {
    it('returns defaults when no AI config exists', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      const result = await controller.getAiConfig();
      expect(result.defaultProvider).toBe('openai');
      expect(result.defaultModel).toBe('');
    });

    it('masks stored API keys', async () => {
      // Import encrypt to create a real encrypted key
      const { encrypt } = await import('./crypto.util');
      const encryptedKey = encrypt('sk-abcdefghijklmnopqrst');

      mockPrismaService.settings.findUnique.mockResolvedValue({
        data: { openaiKey: encryptedKey, defaultProvider: 'openai' },
      });

      const result = await controller.getAiConfig();
      // Key should be masked, not the raw encrypted value
      expect(result.openaiKey).toContain('••••');
      expect(result.openaiKey).not.toBe(encryptedKey);
      expect(result.hasOpenaiKey).toBe(true);
    });

    it('sets hasXxxKey to false for missing keys', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue({
        data: { defaultProvider: 'openai' },
      });

      const result = await controller.getAiConfig();
      expect(result.hasOpenaiKey).toBe(false);
      expect(result.hasAnthropicKey).toBe(false);
    });

    it('returns ••••(corrupted) for unreadable encrypted values', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue({
        data: { openaiKey: 'not-valid-base64-encrypted-data' },
      });

      const result = await controller.getAiConfig();
      expect(result.openaiKey).toBe('••••(corrupted)');
    });
  });

  describe('putAiConfig', () => {
    it('encrypts new API keys before storing', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      mockPrismaService.settings.upsert.mockResolvedValue({ data: {} });

      await controller.putAiConfig({ openaiKey: 'sk-newkey123', defaultProvider: 'openai' });

      const upsertCall = mockPrismaService.settings.upsert.mock.calls[0][0];
      const savedData = upsertCall.create.data;

      // The key should be encrypted (not plaintext)
      expect(savedData.openaiKey).toBeDefined();
      expect(savedData.openaiKey).not.toBe('sk-newkey123');
    });

    it('deletes key when __DELETE__ sentinel is passed', async () => {
      const { encrypt } = await import('./crypto.util');
      const existing = { openaiKey: encrypt('old-key'), defaultProvider: 'openai' };
      mockPrismaService.settings.findUnique.mockResolvedValue({ data: existing });
      mockPrismaService.settings.upsert.mockResolvedValue({ data: {} });

      await controller.putAiConfig({ openaiKey: '__DELETE__' });

      const upsertCall = mockPrismaService.settings.upsert.mock.calls[0][0];
      const savedData = upsertCall.create.data;
      expect(savedData.openaiKey).toBeUndefined();
    });

    it('preserves existing key when masked key is submitted', async () => {
      const { encrypt } = await import('./crypto.util');
      const existingEncrypted = encrypt('existing-key');
      mockPrismaService.settings.findUnique.mockResolvedValue({
        data: { openaiKey: existingEncrypted, defaultProvider: 'openai' },
      });
      mockPrismaService.settings.upsert.mockResolvedValue({ data: {} });

      // Submit with masked key (contains ••)
      await controller.putAiConfig({ openaiKey: 'sk-a••••1234' });

      const upsertCall = mockPrismaService.settings.upsert.mock.calls[0][0];
      const savedData = upsertCall.create.data;
      expect(savedData.openaiKey).toBe(existingEncrypted);
    });

    it('returns masked response with hasXxxKey flags', async () => {
      const { encrypt: _encrypt } = await import('./crypto.util');
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      mockPrismaService.settings.upsert.mockImplementation(({ create }) => ({
        data: create.data,
      }));

      const result = await controller.putAiConfig({
        openaiKey: 'sk-testkey123456789',
        defaultProvider: 'openai',
      });

      expect(result.hasOpenaiKey).toBe(true);
      expect(result.openaiKey).toContain('••••');
    });
  });

  describe('getAiConfigKeys (internal endpoint)', () => {
    it('returns minimal defaults when no X-Internal-Service header', async () => {
      const result = await controller.getAiConfigKeys('');
      expect(result).toEqual({ defaultProvider: 'openai', defaultModel: '' });
    });

    it('returns minimal defaults for unauthorized service', async () => {
      const result = await controller.getAiConfigKeys('unknown-service');
      expect(result).toEqual({ defaultProvider: 'openai', defaultModel: '' });
    });

    it('returns decrypted keys for authorized internal services', async () => {
      const { encrypt } = await import('./crypto.util');
      const encryptedKey = encrypt('sk-secret-api-key');
      mockPrismaService.settings.findUnique.mockResolvedValue({
        data: { openaiKey: encryptedKey, defaultProvider: 'openai', defaultModel: 'gpt-4' },
      });

      const result = await controller.getAiConfigKeys('ai-engine');

      expect(result.openaiKey).toBe('sk-secret-api-key');
      expect(result.defaultProvider).toBe('openai');
    });
  });

  // ── Generic Settings ──

  describe('get (generic)', () => {
    it('returns settings data for a key', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue({ data: { foo: 'bar' } });
      const result = await controller.get('some-key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns empty object when key not found', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue(null);
      const result = await controller.get('missing-key');
      expect(result).toEqual({});
    });
  });

  describe('put (generic)', () => {
    it('upserts settings and returns updated data', async () => {
      const body = { some: 'value' };
      mockPrismaService.settings.upsert.mockResolvedValue({ data: body });

      const result = await controller.put('my-key', body);

      expect(mockPrismaService.settings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId_key: { tenantId: DEMO_TENANT_ID, key: 'my-key' } },
          create: { tenantId: DEMO_TENANT_ID, key: 'my-key', data: body },
          update: { data: body },
        }),
      );
      expect(result).toEqual(body);
    });
  });

  // ── Tenant-scoped branding ──

  describe('branding (tenant scope, no enterprise ctx)', () => {
    it('reads the DEMO tenant branding row by (tenantId, key)', async () => {
      mockPrismaService.settings.findUnique.mockResolvedValue({ data: {} });
      await controller.getBranding();
      expect(mockPrismaService.settings.findUnique).toHaveBeenCalledWith({
        where: { tenantId_key: { tenantId: DEMO_TENANT_ID, key: 'branding' } },
      });
    });
  });
});

describe('SettingsController with tenant context', () => {
  let controller: SettingsController;

  const mockTenantCtx = {
    get: jest.fn().mockReturnValue({ tenantId: '33333333-3333-3333-3333-333333333333' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TENANT_CONTEXT_PROVIDER, useValue: mockTenantCtx },
        {
          provide: LicenseService,
          useValue: {
            hasFeature: jest.fn().mockResolvedValue(true),
            getLicenseStatus: jest.fn().mockResolvedValue({ edition: 'community' }),
          },
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    jest.clearAllMocks();
  });

  it('scopes branding to the enterprise tenant via (tenantId, key)', async () => {
    mockPrismaService.settings.findUnique.mockResolvedValue({ data: { primaryColor: '#tenantColor' } });

    const result = await controller.getBranding();

    expect(mockPrismaService.settings.findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: '33333333-3333-3333-3333-333333333333', key: 'branding' } },
    });
    expect(result).toEqual({ primaryColor: '#tenantColor' });
  });

  it('does NOT fall back to another tenant when the row is missing', async () => {
    mockPrismaService.settings.findUnique.mockResolvedValue(null);

    const result = await controller.getBranding();

    // Exactly one scoped lookup, no global/cross-tenant second read.
    expect(mockPrismaService.settings.findUnique).toHaveBeenCalledTimes(1);
    expect(result).toEqual({});
  });
});

// ── GAPS #1: cross-tenant Settings isolation ──
describe('SettingsController tenant isolation (GAPS #1)', () => {
  function controllerForTenant(tenantId: string) {
    const prisma = {
      settings: { findUnique: jest.fn(), upsert: jest.fn() },
      user: { count: jest.fn() },
    };
    const ctx = { get: () => ({ tenantId }) };
    return { prisma, ctx };
  }

  async function build(prisma: any, ctx: any) {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: TENANT_CONTEXT_PROVIDER, useValue: ctx },
        {
          provide: LicenseService,
          useValue: {
            hasFeature: jest.fn().mockResolvedValue(true),
            getLicenseStatus: jest.fn().mockResolvedValue({ edition: 'community' }),
          },
        },
      ],
    }).compile();
    return module.get<SettingsController>(SettingsController);
  }

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  it('tenant A reads only its OWN ai-config row (cannot read tenant B)', async () => {
    const { prisma, ctx } = controllerForTenant(TENANT_A);
    prisma.settings.findUnique.mockResolvedValue({ data: { defaultProvider: 'openai' } });
    const controller = await build(prisma, ctx);

    await controller.getAiConfig();

    expect(prisma.settings.findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: TENANT_A, key: 'ai-config' } },
    });
  });

  it('ai-config/keys scopes decrypted reads to the forwarded x-tenant-id', async () => {
    const { prisma, ctx } = controllerForTenant(TENANT_B);
    const { encrypt } = await import('./crypto.util');
    prisma.settings.findUnique.mockResolvedValue({
      data: { openaiKey: encrypt('sk-tenant-B-secret'), defaultProvider: 'openai' },
    });
    const controller = await build(prisma, ctx);

    const result = await runWithTenant(TENANT_A, () =>
      controller.getAiConfigKeys('ai-engine', TENANT_A),
    );

    // Read MUST be scoped to the forwarded tenant (A), not the ambient ctx (B).
    expect(prisma.settings.findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: TENANT_A, key: 'ai-config' } },
    });
    expect(result.openaiKey).toBe('sk-tenant-B-secret'); // value comes from the (mocked) A-scoped read
  });

  it('ai-config/keys with no/invalid x-tenant-id falls back to the DEMO tenant', async () => {
    const { prisma, ctx } = controllerForTenant(TENANT_A);
    prisma.settings.findUnique.mockResolvedValue(null);
    const controller = await build(prisma, ctx);

    await controller.getAiConfigKeys('ai-engine', undefined);

    expect(prisma.settings.findUnique).toHaveBeenCalledWith({
      where: { tenantId_key: { tenantId: DEMO_TENANT_ID, key: 'ai-config' } },
    });
  });

  it('ai-config writes are scoped to the writing tenant', async () => {
    const { prisma, ctx } = controllerForTenant(TENANT_A);
    prisma.settings.findUnique.mockResolvedValue(null);
    prisma.settings.upsert.mockResolvedValue({ data: {} });
    const controller = await build(prisma, ctx);

    await controller.putAiConfig({ openaiKey: 'sk-newkey', defaultProvider: 'openai' });

    expect(prisma.settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_key: { tenantId: TENANT_A, key: 'ai-config' } },
      }),
    );
  });
});
