import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockConversation = {
  id: 'conv-1',
  title: 'Test Conversation',
  status: 'OPEN',
  channel: 'web',
  userId: 'user-1',
  assigneeId: null,
  assigneeName: null,
  contactId: null,
  contactName: null,
  contactEmail: null,
  metadata: {},
  closedAt: null,
  messages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  content: 'Hello',
  role: 'user',
  authorId: 'user-1',
  authorName: null,
  authorType: 'human',
  metadata: {},
  createdAt: new Date(),
};

const mockPrismaService = {
  conversation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a conversation', async () => {
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.create('user-1', { title: 'Test', channel: 'web' });

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', channel: 'web' }) }),
      );
      expect(result).toEqual(mockConversation);
    });

    it('creates initial message when provided', async () => {
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);
      mockPrismaService.conversationMessage.create.mockResolvedValue(mockMessage);
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await service.create('user-1', { initialMessage: 'Hello' });

      expect(mockPrismaService.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ content: 'Hello', conversationId: 'conv-1' }) }),
      );
    });

    it('defaults channel to web', async () => {
      mockPrismaService.conversation.create.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await service.create('user-1', {});

      expect(mockPrismaService.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: 'web' }) }),
      );
    });
  });

  describe('list', () => {
    it('returns paginated conversations', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([mockConversation]);
      mockPrismaService.conversation.count.mockResolvedValue(1);

      const result = await service.list({ userId: 'user-1' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      mockPrismaService.conversation.count.mockResolvedValue(0);

      await service.list({ status: 'OPEN' });

      expect(mockPrismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
      );
    });

    it('filters by channel', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      mockPrismaService.conversation.count.mockResolvedValue(0);

      await service.list({ channel: 'telegram' });

      expect(mockPrismaService.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ channel: 'telegram' }) }),
      );
    });

    it('applies search as OR across title, contactName, contactEmail', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      mockPrismaService.conversation.count.mockResolvedValue(0);

      await service.list({ search: 'john' });

      const call = mockPrismaService.conversation.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
    });

    it('caps limit at 100', async () => {
      mockPrismaService.conversation.findMany.mockResolvedValue([]);
      mockPrismaService.conversation.count.mockResolvedValue(0);

      const result = await service.list({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });

  describe('findOne', () => {
    it('returns conversation by id', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.findOne('conv-1');
      expect(result).toEqual(mockConversation);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates conversation fields', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.update.mockResolvedValue({ ...mockConversation, title: 'Updated' });

      const result = await service.update('conv-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('assign', () => {
    it('assigns conversation and sets status to ASSIGNED', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'ASSIGNED',
        assigneeId: 'agent-1',
        assigneeName: 'Agent One',
      });

      const result = await service.assign('conv-1', 'agent-1', 'Agent One');

      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assigneeId: 'agent-1', status: 'ASSIGNED' }),
        }),
      );
      expect(result.status).toBe('ASSIGNED');
    });
  });

  describe('transition', () => {
    it('transitions from OPEN to ASSIGNED', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.update.mockResolvedValue({ ...mockConversation, status: 'ASSIGNED' });

      const result = await service.transition('conv-1', 'ASSIGNED');
      expect(result.status).toBe('ASSIGNED');
    });

    it('sets closedAt when transitioning to CLOSED', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.update.mockResolvedValue({ ...mockConversation, status: 'CLOSED' });

      await service.transition('conv-1', 'CLOSED');

      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ closedAt: expect.any(Date) }) }),
      );
    });

    it('throws BadRequestException for invalid transition', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue({ ...mockConversation, status: 'CLOSED' });

      await expect(service.transition('conv-1', 'OPEN')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unknown target status', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.transition('conv-1', 'INVALID')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getHistory', () => {
    it('returns paginated messages for a conversation', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversationMessage.findMany.mockResolvedValue([mockMessage]);
      mockPrismaService.conversationMessage.count.mockResolvedValue(1);

      const result = await service.getHistory('conv-1');

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('throws NotFoundException for unknown conversation', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addMessage', () => {
    it('adds a message to a conversation', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversationMessage.create.mockResolvedValue(mockMessage);
      mockPrismaService.conversation.update.mockResolvedValue(mockConversation);

      const result = await service.addMessage('conv-1', 'user-1', { content: 'Hello' });

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'conv-1' } }),
      );
    });
  });

  describe('remove', () => {
    it('deletes a conversation', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.conversation.delete.mockResolvedValue(mockConversation);

      await service.remove('conv-1');

      expect(mockPrismaService.conversation.delete).toHaveBeenCalledWith({ where: { id: 'conv-1' } });
    });

    it('throws NotFoundException for unknown conversation', async () => {
      mockPrismaService.conversation.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
