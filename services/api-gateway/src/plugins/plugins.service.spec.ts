import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockPlugin = {
  id: 'plugin-1',
  name: 'Test Plugin',
  slug: 'test-plugin',
  type: 'utility',
  author: 'Test Author',
  version: '1.0.0',
  description: 'A test plugin',
  icon: null,
  downloads: 0,
  rating: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockVersion = {
  id: 'version-1',
  pluginId: 'plugin-1',
  semver: '1.0.0',
  artifactUrl: 'https://example.com/plugin.tar.gz',
  checksum: 'abc123',
  changelog: null,
  compatibility: {},
  createdAt: new Date(),
};

const mockInstallation = {
  id: 'install-1',
  instanceId: 'default',
  pluginId: 'plugin-1',
  version: '1.0.0',
  enabled: true,
  config: {},
  installedAt: new Date(),
  updatedAt: new Date(),
};

describe('PluginsService', () => {
  let service: PluginsService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      plugin: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pluginVersion: {
        findUnique: jest.fn(),
      },
      pluginInstallation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
  });

  describe('browse', () => {
    it('returns paginated plugins', async () => {
      prisma.plugin.findMany.mockResolvedValue([mockPlugin]);
      prisma.plugin.count.mockResolvedValue(1);

      const result = await service.browse({ page: 1, limit: 20 });

      expect(result.plugins).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies search filter', async () => {
      prisma.plugin.findMany.mockResolvedValue([]);
      prisma.plugin.count.mockResolvedValue(0);

      await service.browse({ search: 'test', page: 1, limit: 20 });

      expect(prisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });

    it('applies type filter', async () => {
      prisma.plugin.findMany.mockResolvedValue([]);
      prisma.plugin.count.mockResolvedValue(0);

      await service.browse({ type: 'utility', page: 1, limit: 20 });

      expect(prisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'utility' }),
        }),
      );
    });
  });

  describe('findBySlug', () => {
    it('returns plugin by slug', async () => {
      prisma.plugin.findUnique.mockResolvedValue({ ...mockPlugin, versions: [mockVersion] });
      const result = await service.findBySlug('test-plugin');
      expect(result.slug).toBe('test-plugin');
    });

    it('throws NotFoundException for unknown slug', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates plugin with initial version', async () => {
      prisma.plugin.findUnique.mockResolvedValue(null);
      prisma.plugin.create.mockResolvedValue({ ...mockPlugin, versions: [mockVersion] });

      const result = await service.create({
        name: 'Test Plugin',
        slug: 'test-plugin',
        type: 'utility',
        author: 'Test Author',
        version: '1.0.0',
        description: 'A test plugin',
        artifactUrl: 'https://example.com/plugin.tar.gz',
        checksum: 'abc123',
      });

      expect(result.slug).toBe('test-plugin');
      expect(prisma.plugin.create).toHaveBeenCalled();
    });

    it('throws ConflictException if slug already exists', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      await expect(
        service.create({
          name: 'Test Plugin',
          slug: 'test-plugin',
          type: 'utility',
          author: 'Test Author',
          version: '1.0.0',
          description: 'desc',
          artifactUrl: 'https://example.com/plugin.tar.gz',
          checksum: 'abc123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('install', () => {
    it('installs plugin successfully', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginVersion.findUnique.mockResolvedValue(mockVersion);
      prisma.pluginInstallation.findUnique.mockResolvedValue(null);
      prisma.pluginInstallation.create.mockResolvedValue(mockInstallation);
      prisma.plugin.update.mockResolvedValue(mockPlugin);

      const result = await service.install('plugin-1', {}, 'user-1', 'user@test.com');
      expect(result.pluginId).toBe('plugin-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'install' }));
    });

    it('throws BadRequestException for unknown version', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginVersion.findUnique.mockResolvedValue(null);

      await expect(
        service.install('plugin-1', { version: '9.9.9' }, 'user-1', 'user@test.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if already installed', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginVersion.findUnique.mockResolvedValue(mockVersion);
      prisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation);

      await expect(
        service.install('plugin-1', {}, 'user-1', 'user@test.com'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('uninstall', () => {
    it('uninstalls plugin successfully', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation);
      prisma.pluginInstallation.delete.mockResolvedValue(mockInstallation);

      await service.uninstall('plugin-1', 'default', 'user-1', 'user@test.com');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'uninstall' }));
    });

    it('throws NotFoundException if not installed', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(
        service.uninstall('plugin-1', 'default', 'user-1', 'user@test.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setEnabled', () => {
    it('enables plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation);
      prisma.pluginInstallation.update.mockResolvedValue({ ...mockInstallation, enabled: true });

      const result = await service.setEnabled('plugin-1', true, 'default', 'user-1', 'user@test.com');
      expect(result.enabled).toBe(true);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'enable' }));
    });

    it('disables plugin', async () => {
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation);
      prisma.pluginInstallation.update.mockResolvedValue({ ...mockInstallation, enabled: false });

      const result = await service.setEnabled('plugin-1', false, 'default', 'user-1', 'user@test.com');
      expect(result.enabled).toBe(false);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'disable' }));
    });
  });

  describe('configure', () => {
    it('updates plugin config', async () => {
      const newConfig = { apiKey: 'secret' };
      prisma.plugin.findUnique.mockResolvedValue(mockPlugin);
      prisma.pluginInstallation.findUnique.mockResolvedValue(mockInstallation);
      prisma.pluginInstallation.update.mockResolvedValue({ ...mockInstallation, config: newConfig });

      const result = await service.configure(
        'plugin-1',
        { config: newConfig },
        'default',
        'user-1',
        'user@test.com',
      );
      expect(result.config).toEqual(newConfig);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'configure' }));
    });
  });
});
