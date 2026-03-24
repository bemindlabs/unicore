import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PluginsService } from './plugins.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

describe('PluginsService (developer endpoints)', () => {
  let service: PluginsService;

  const mockPrisma = {
    plugin: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pluginVersion: { findUnique: jest.fn() },
    pluginInstallation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAudit = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
    jest.clearAllMocks();
  });

  const baseDto = {
    name: 'My Plugin',
    slug: 'my-plugin',
    type: 'integration',
    description: 'A test plugin',
    version: '1.0.0',
    author: 'dev@test.com',
  };

  describe('submit', () => {
    it('creates a draft plugin', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);
      const created = { id: 'p1', ...baseDto, status: 'draft', submittedBy: 'user-1' };
      mockPrisma.plugin.create.mockResolvedValue(created);

      const result = await service.submit(baseDto, 'user-1');

      expect(result).toEqual(created);
      expect(mockPrisma.plugin.create).toHaveBeenCalledWith({
        data: { ...baseDto, status: 'draft', submittedBy: 'user-1' },
      });
    });

    it('throws ConflictException if slug is taken', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.submit(baseDto, 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getMyPlugins', () => {
    it('returns plugins for the current user', async () => {
      const plugins = [{ id: 'p1', submittedBy: 'user-1' }];
      mockPrisma.plugin.findMany.mockResolvedValue(plugins);

      const result = await service.getMyPlugins('user-1');

      expect(result).toEqual(plugins);
      expect(mockPrisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { submittedBy: 'user-1' } }),
      );
    });
  });

  describe('getPending', () => {
    it('returns plugins with pending status', async () => {
      const plugins = [{ id: 'p2', status: 'pending' }];
      mockPrisma.plugin.findMany.mockResolvedValue(plugins);

      const result = await service.getPending();

      expect(result).toEqual(plugins);
      expect(mockPrisma.plugin.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'pending' } }),
      );
    });
  });

  describe('approve', () => {
    it('approves a pending plugin', async () => {
      const plugin = { id: 'p3', status: 'pending' };
      mockPrisma.plugin.findUnique.mockResolvedValue(plugin);
      const approved = { ...plugin, status: 'approved', reviewedBy: 'admin-1' };
      mockPrisma.plugin.update.mockResolvedValue(approved);

      const result = await service.approve('p3', 'admin-1');

      expect(result.status).toBe('approved');
      expect(mockPrisma.plugin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p3' },
          data: expect.objectContaining({ status: 'approved', reviewedBy: 'admin-1' }),
        }),
      );
    });

    it('throws NotFoundException if plugin not found', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.approve('nonexistent', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if plugin is not pending', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: 'p4', status: 'draft' });

      await expect(service.approve('p4', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects a pending plugin with a reason', async () => {
      const plugin = { id: 'p5', status: 'pending' };
      mockPrisma.plugin.findUnique.mockResolvedValue(plugin);
      const rejected = { ...plugin, status: 'rejected', rejectionReason: 'Policy violation' };
      mockPrisma.plugin.update.mockResolvedValue(rejected);

      const result = await service.reject('p5', 'admin-1', 'Policy violation');

      expect(result.status).toBe('rejected');
      expect(mockPrisma.plugin.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p5' },
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Policy violation',
            reviewedBy: 'admin-1',
          }),
        }),
      );
    });

    it('throws NotFoundException if plugin not found', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);

      await expect(service.reject('nonexistent', 'admin-1', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if plugin is not pending', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue({ id: 'p6', status: 'approved' });

      await expect(service.reject('p6', 'admin-1', 'reason')).rejects.toThrow(BadRequestException);
    });
  });
});
