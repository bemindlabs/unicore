import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  auditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('creates an audit log entry', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({});

      await service.log({
        userId: 'user-1',
        userEmail: 'user@test.com',
        action: 'create',
        resource: 'contacts',
        resourceId: 'contact-1',
        detail: 'Created contact',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'create',
          resource: 'contacts',
        }),
      });
    });

    it('does not throw when Prisma create fails (swallows errors)', async () => {
      mockPrismaService.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({ action: 'test', resource: 'users' }),
      ).resolves.not.toThrow();
    });

    it('works with minimal fields', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({});
      await service.log({ action: 'login', resource: 'auth' });
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('query', () => {
    it('returns paginated results', async () => {
      const mockData = [{ id: '1', action: 'login', resource: 'auth', timestamp: new Date() }];
      mockPrismaService.auditLog.findMany.mockResolvedValue(mockData);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.query({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockData);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('filters by action', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.query({ action: 'delete' });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ action: 'delete' }) }),
      );
    });

    it('filters by resource', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.query({ resource: 'users' });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ resource: 'users' }) }),
      );
    });

    it('applies search as OR across userEmail, resource, detail', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.query({ search: 'test-user' });

      const findManyCall = mockPrismaService.auditLog.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toBeDefined();
      expect(findManyCall.where.OR).toHaveLength(3);
    });

    it('uses defaults: page=1, limit=50', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.query({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 50 }),
      );
    });

    it('caps limit at 500', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      const result = await service.query({ limit: 1000 });
      expect(result.limit).toBe(500);
    });

    it('calculates totalPages correctly', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(105);

      const result = await service.query({ limit: 10 });
      expect(result.totalPages).toBe(11);
    });

    it('calculates correct skip for page 3', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.query({ page: 3, limit: 20 });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });
});
