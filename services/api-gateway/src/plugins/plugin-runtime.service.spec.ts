import { Test, TestingModule } from '@nestjs/testing';
import { PluginRuntimeService } from './plugin-runtime.service';
import { PrismaService } from '../prisma/prisma.service';
import { PluginLoadError } from '@unicore/plugin-sdk';

// ─── SDK mocks ────────────────────────────────────────────────────────────────

const mockLifecycleRegister = jest.fn();
const mockLifecycleActivate = jest.fn();
const mockLifecycleDeactivateAll = jest.fn();
const mockLifecycleGetActive = jest.fn(() => []);
const mockLoaderLoadFromFile = jest.fn();

jest.mock('@unicore/plugin-sdk', () => {
  class PluginLoadError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PluginLoadError';
    }
  }
  return {
    PluginLifecycleManager: jest.fn().mockImplementation(() => ({
      register: mockLifecycleRegister,
      activate: mockLifecycleActivate,
      deactivateAll: mockLifecycleDeactivateAll,
      getActive: mockLifecycleGetActive,
    })),
    PluginLoader: jest.fn().mockImplementation(() => ({
      loadFromFile: mockLoaderLoadFromFile,
    })),
    PluginLoadError,
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeInstallation = (overrides: Partial<{
  pluginId: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
}> = {}) => ({
  id: 'install-1',
  instanceId: 'default',
  pluginId: 'plugin-a',
  version: '1.0.0',
  enabled: true,
  config: {},
  installedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makePlugin = (id = 'plugin-a') => ({
  manifest: { id, name: 'Plugin A', version: '1.0.0', type: 'integration', entrypoint: 'index.js' },
  activate: jest.fn(),
  deactivate: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PluginRuntimeService', () => {
  let service: PluginRuntimeService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockLifecycleGetActive.mockReturnValue([]);

    prisma = {
      pluginInstallation: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginRuntimeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PluginRuntimeService>(PluginRuntimeService);
  });

  // ─── onModuleInit ──────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('does nothing when no enabled installations exist', async () => {
      prisma.pluginInstallation.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(mockLoaderLoadFromFile).not.toHaveBeenCalled();
      expect(mockLifecycleRegister).not.toHaveBeenCalled();
    });

    it('queries only enabled installations', async () => {
      prisma.pluginInstallation.findMany.mockResolvedValue([]);

      await service.onModuleInit();

      expect(prisma.pluginInstallation.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
      });
    });

    it('loads, registers, and activates each enabled plugin', async () => {
      const installation = makeInstallation({ config: { apiKey: 'secret' } });
      const plugin = makePlugin('plugin-a');

      prisma.pluginInstallation.findMany.mockResolvedValue([installation]);
      mockLoaderLoadFromFile.mockResolvedValue(plugin);

      await service.onModuleInit();

      expect(mockLoaderLoadFromFile).toHaveBeenCalledWith(
        '/app/plugins/plugin-a/1.0.0/manifest.json',
      );
      expect(mockLifecycleRegister).toHaveBeenCalledWith(plugin);
      expect(mockLifecycleActivate).toHaveBeenCalledWith('plugin-a', { apiKey: 'secret' });
    });

    it('activates multiple plugins', async () => {
      const instA = makeInstallation({ pluginId: 'plugin-a', version: '1.0.0' });
      const instB = makeInstallation({ id: 'install-2', pluginId: 'plugin-b', version: '2.0.0' });
      const pluginA = makePlugin('plugin-a');
      const pluginB = makePlugin('plugin-b');

      prisma.pluginInstallation.findMany.mockResolvedValue([instA, instB]);
      mockLoaderLoadFromFile
        .mockResolvedValueOnce(pluginA)
        .mockResolvedValueOnce(pluginB);

      await service.onModuleInit();

      expect(mockLifecycleRegister).toHaveBeenCalledTimes(2);
      expect(mockLifecycleActivate).toHaveBeenCalledTimes(2);
    });

    it('skips a plugin when artifact is missing (PluginLoadError) without throwing', async () => {
      const installation = makeInstallation();
      prisma.pluginInstallation.findMany.mockResolvedValue([installation]);
      mockLoaderLoadFromFile.mockRejectedValue(
        new PluginLoadError("Cannot read manifest at '/app/plugins/plugin-a/1.0.0/manifest.json'"),
      );

      await expect(service.onModuleInit()).resolves.not.toThrow();
      expect(mockLifecycleRegister).not.toHaveBeenCalled();
    });

    it('logs an error (but does not throw) when activation fails', async () => {
      const installation = makeInstallation();
      const plugin = makePlugin();
      prisma.pluginInstallation.findMany.mockResolvedValue([installation]);
      mockLoaderLoadFromFile.mockResolvedValue(plugin);
      mockLifecycleActivate.mockRejectedValue(new Error('activate failed'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('uses empty object as config when installation.config is null', async () => {
      const installation = makeInstallation({ config: null as any });
      const plugin = makePlugin();
      prisma.pluginInstallation.findMany.mockResolvedValue([installation]);
      mockLoaderLoadFromFile.mockResolvedValue(plugin);

      await service.onModuleInit();

      expect(mockLifecycleActivate).toHaveBeenCalledWith('plugin-a', {});
    });
  });

  // ─── onApplicationShutdown ─────────────────────────────────────────────────

  describe('onApplicationShutdown', () => {
    it('calls deactivateAll when plugins are active', async () => {
      mockLifecycleGetActive.mockReturnValue([{}, {}]); // 2 active

      await service.onApplicationShutdown();

      expect(mockLifecycleDeactivateAll).toHaveBeenCalledTimes(1);
    });

    it('skips deactivateAll when no plugins are active', async () => {
      mockLifecycleGetActive.mockReturnValue([]);

      await service.onApplicationShutdown();

      expect(mockLifecycleDeactivateAll).not.toHaveBeenCalled();
    });
  });

  // ─── getActiveCount ────────────────────────────────────────────────────────

  describe('getActiveCount', () => {
    it('returns the number of active plugins', () => {
      mockLifecycleGetActive.mockReturnValue([{}, {}, {}]);
      expect(service.getActiveCount()).toBe(3);
    });

    it('returns 0 when no plugins are active', () => {
      mockLifecycleGetActive.mockReturnValue([]);
      expect(service.getActiveCount()).toBe(0);
    });
  });
});
