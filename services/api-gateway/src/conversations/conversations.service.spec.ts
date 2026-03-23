import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  conversation: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  contactChannel: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  conversationParticipant: {
    upsert: jest.fn(),
    updateMany: jest.fn(),
  },
};

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns conversations and total', async () => {
      const conv = { id: 'c1', channel: 'TELEGRAM', status: 'OPEN' };
      mockPrisma.conversation.findMany.mockResolvedValue([conv]);
      mockPrisma.conversation.count.mockResolvedValue(1);

      const result = await service.list();

      expect(result).toEqual({ conversations: [conv], total: 1 });
      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies channel filter', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.list({ channel: 'TELEGRAM' });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel: 'TELEGRAM' } }),
      );
    });
  });

  // ─── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns conversation when found', async () => {
      const conv = { id: 'c1', channel: 'LINE', status: 'OPEN', messages: [], participants: [] };
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);

      const result = await service.findOne('c1');

      expect(result).toEqual(conv);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a conversation', async () => {
      const dto = { channel: 'TELEGRAM' as any, subject: 'Hello' };
      const created = { id: 'c1', ...dto, status: 'OPEN' };
      mockPrisma.conversation.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: 'TELEGRAM' }) }),
      );
    });
  });

  // ─── sendMessage ──────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('creates a message and updates lastMessageAt', async () => {
      const conv = { id: 'c1' };
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);
      const msg = { id: 'm1', conversationId: 'c1', content: 'Hi', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(msg);
      mockPrisma.conversation.update.mockResolvedValue({ ...conv, lastMessageAt: msg.createdAt });

      const result = await service.sendMessage('c1', { content: 'Hi' }, 'OUTBOUND');

      expect(result).toEqual(msg);
      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'Hi', direction: 'OUTBOUND' }),
        }),
      );
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' } }),
      );
    });

    it('throws when conversation not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage('missing', { content: 'Hi' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── assign ───────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('assigns an operator and sets status to ASSIGNED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'c1', assigneeId: 'u1', status: 'ASSIGNED' });

      const result = await service.assign('c1', 'u1');

      expect(result.status).toBe('ASSIGNED');
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assigneeId: 'u1', status: 'ASSIGNED' },
        }),
      );
    });

    it('unassigns and reverts status to OPEN', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: 'c1' });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'c1', assigneeId: null, status: 'OPEN' });

      await service.assign('c1', null);

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assigneeId: null, status: 'OPEN' },
        }),
      );
    });
  });

  // ─── upsertContactChannel ─────────────────────────────────────────────────

  describe('upsertContactChannel', () => {
    it('upserts a contact channel record', async () => {
      const dto = { channel: 'TELEGRAM' as any, externalId: '12345', displayName: 'Alice' };
      const record = { id: 'cc1', ...dto };
      mockPrisma.contactChannel.upsert.mockResolvedValue(record);

      const result = await service.upsertContactChannel(dto);

      expect(result).toEqual(record);
      expect(mockPrisma.contactChannel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { channel_externalId: { channel: 'TELEGRAM', externalId: '12345' } },
        }),
      );
    });
  });

  // ─── addParticipant ───────────────────────────────────────────────────────

  describe('addParticipant', () => {
    it('adds a participant to a conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({ id: 'c1' });
      const participant = { id: 'p1', conversationId: 'c1', userId: 'u1', role: 'operator' };
      mockPrisma.conversationParticipant.upsert.mockResolvedValue(participant);

      const result = await service.addParticipant('c1', 'u1');

      expect(result).toEqual(participant);
    });
  });
});
