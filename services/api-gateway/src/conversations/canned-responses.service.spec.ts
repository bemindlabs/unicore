import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CannedResponsesService } from './canned-responses.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockCanned = {
  id: 'cr-1',
  shortcut: 'greeting',
  text: 'Hello! How can I help you today?',
  category: 'general',
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

// ─── Mock PrismaService ───────────────────────────────────────────────────────

const mockPrisma = {
  cannedResponse: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CannedResponsesService', () => {
  let service: CannedResponsesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CannedResponsesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CannedResponsesService>(CannedResponsesService);
  });

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated canned responses', async () => {
      mockPrisma.cannedResponse.findMany.mockResolvedValue([mockCanned]);
      mockPrisma.cannedResponse.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result).toEqual({ items: [mockCanned], total: 1 });
      expect(mockPrisma.cannedResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { shortcut: 'asc' }, take: 50 }),
      );
    });

    it('filters by category', async () => {
      mockPrisma.cannedResponse.findMany.mockResolvedValue([]);
      mockPrisma.cannedResponse.count.mockResolvedValue(0);

      await service.list({ category: 'billing' });

      expect(mockPrisma.cannedResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'billing' } }),
      );
    });

    it('applies search filter with OR clause', async () => {
      mockPrisma.cannedResponse.findMany.mockResolvedValue([mockCanned]);
      mockPrisma.cannedResponse.count.mockResolvedValue(1);

      await service.list({ search: 'hello' });

      const call = mockPrisma.cannedResponse.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(2);
    });

    it('caps take at 200', async () => {
      mockPrisma.cannedResponse.findMany.mockResolvedValue([]);
      mockPrisma.cannedResponse.count.mockResolvedValue(0);

      await service.list({ limit: 9999 });

      expect(mockPrisma.cannedResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 200 }),
      );
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a new canned response', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);
      mockPrisma.cannedResponse.create.mockResolvedValue(mockCanned);

      const result = await service.create(
        { shortcut: 'greeting', text: 'Hello!', category: 'general' },
        'user-1',
      );

      expect(result).toEqual(mockCanned);
      expect(mockPrisma.cannedResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shortcut: 'greeting', createdBy: 'user-1' }),
        }),
      );
    });

    it('strips leading slash from shortcut', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);
      mockPrisma.cannedResponse.create.mockResolvedValue({ ...mockCanned, shortcut: 'hi' });

      await service.create({ shortcut: '/hi', text: 'Hi there!' }, 'user-1');

      expect(mockPrisma.cannedResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shortcut: 'hi' }),
        }),
      );
    });

    it('throws ConflictException when shortcut already exists', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(mockCanned);

      await expect(
        service.create({ shortcut: 'greeting', text: 'Duplicate' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates text and category', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(mockCanned);
      mockPrisma.cannedResponse.findFirst.mockResolvedValue(null);
      mockPrisma.cannedResponse.update.mockResolvedValue({ ...mockCanned, text: 'Updated!' });

      const result = await service.update('cr-1', { text: 'Updated!' });

      expect(result.text).toBe('Updated!');
      expect(mockPrisma.cannedResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cr-1' } }),
      );
    });

    it('throws NotFoundException when record does not exist', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);

      await expect(service.update('missing-id', { text: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when updated shortcut conflicts', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(mockCanned);
      mockPrisma.cannedResponse.findFirst.mockResolvedValue({ id: 'cr-99', shortcut: 'taken' });

      await expect(service.update('cr-1', { shortcut: 'taken' })).rejects.toThrow(ConflictException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes an existing canned response', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(mockCanned);
      mockPrisma.cannedResponse.delete.mockResolvedValue(mockCanned);

      await service.remove('cr-1');

      expect(mockPrisma.cannedResponse.delete).toHaveBeenCalledWith({ where: { id: 'cr-1' } });
    });

    it('throws NotFoundException when record does not exist', async () => {
      mockPrisma.cannedResponse.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
