import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  chatHistory: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ChatHistoryService', () => {
  let service: ChatHistoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatHistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChatHistoryService>(ChatHistoryService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated chat histories', async () => {
      const items = [{ id: 'h-1', agentId: 'router' }];
      mockPrisma.chatHistory.findMany.mockResolvedValue(items);
      mockPrisma.chatHistory.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('filters by agentId and channel', async () => {
      mockPrisma.chatHistory.findMany.mockResolvedValue([]);
      mockPrisma.chatHistory.count.mockResolvedValue(0);

      await service.list({ agentId: 'router', channel: 'chat-backoffice' });

      expect(mockPrisma.chatHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentId: 'router', channel: 'chat-backoffice' }),
        }),
      );
    });

    it('applies date range filters', async () => {
      mockPrisma.chatHistory.findMany.mockResolvedValue([]);
      mockPrisma.chatHistory.count.mockResolvedValue(0);

      await service.list({ from: '2026-01-01', to: '2026-12-31' });

      const call = mockPrisma.chatHistory.findMany.mock.calls[0][0];
      expect(call.where.createdAt).toEqual({
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      });
    });
  });

  describe('create', () => {
    it('creates a chat history record with plain text messages', async () => {
      const created = { id: 'h-1', agentId: 'router', messages: [] };
      mockPrisma.chatHistory.create.mockResolvedValue(created);

      const result = await service.create({
        agentId: 'router',
        agentName: 'Router',
        userId: 'u-1',
        userName: 'Alice',
        messages: [
          { id: 'm-1', text: 'Hello', author: 'Alice', authorId: 'u-1', authorType: 'human' },
          { id: 'm-2', text: 'Hi there', author: 'Router', authorId: 'router', authorType: 'agent' },
        ],
        channel: 'chat-backoffice',
      });

      expect(result).toEqual(created);
      expect(mockPrisma.chatHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: 'router',
          userId: 'u-1',
          channel: 'chat-backoffice',
        }),
      });
    });

    it('persists messages with tool calls (UNC-1029)', async () => {
      const created = { id: 'h-2' };
      mockPrisma.chatHistory.create.mockResolvedValue(created);

      const toolCallMsg = {
        id: 'm-3',
        author: 'Router',
        authorId: 'router',
        authorType: 'agent',
        toolCalls: [
          {
            toolName: 'get_order',
            arguments: { orderId: 'ORD-001' },
            result: { id: 'ORD-001', status: 'pending' },
            status: 'success' as const,
          },
        ],
      };

      await service.create({
        agentId: 'router',
        agentName: 'Router',
        userId: 'u-1',
        userName: 'Alice',
        messages: [toolCallMsg],
      });

      const createCall = mockPrisma.chatHistory.create.mock.calls[0][0];
      const savedMessages = createCall.data.messages as typeof toolCallMsg[];
      expect(savedMessages[0].toolCalls).toEqual(toolCallMsg.toolCalls);
    });

    it('persists messages with suggested actions (UNC-1029)', async () => {
      mockPrisma.chatHistory.create.mockResolvedValue({ id: 'h-3' });

      const actionMsg = {
        id: 'm-4',
        text: 'Would you like to confirm?',
        author: 'Router',
        authorId: 'router',
        authorType: 'agent',
        suggestedActions: [
          { label: 'Confirm Order', value: 'confirm_order', variant: 'confirm' as const },
          { label: 'View Invoice', value: 'view_invoice', variant: 'default' as const },
        ],
      };

      await service.create({
        agentId: 'router',
        agentName: 'Router',
        userId: 'u-1',
        userName: 'Alice',
        messages: [actionMsg],
      });

      const createCall = mockPrisma.chatHistory.create.mock.calls[0][0];
      const savedMessages = createCall.data.messages as typeof actionMsg[];
      expect(savedMessages[0].suggestedActions).toEqual(actionMsg.suggestedActions);
    });

    it('auto-generates summary from first human message', async () => {
      mockPrisma.chatHistory.create.mockResolvedValue({ id: 'h-4' });

      await service.create({
        agentId: 'router',
        agentName: 'Router',
        userId: 'u-1',
        userName: 'Alice',
        messages: [
          { id: 'm-5', text: 'Show me my orders', author: 'Alice', authorId: 'u-1', authorType: 'human' },
        ],
      });

      const createCall = mockPrisma.chatHistory.create.mock.calls[0][0];
      expect(createCall.data.summary).toBe('Show me my orders');
    });

    it('defaults channel to "command" when not provided', async () => {
      mockPrisma.chatHistory.create.mockResolvedValue({ id: 'h-5' });

      await service.create({
        agentId: 'router',
        agentName: 'Router',
        userId: 'u-1',
        userName: 'Alice',
        messages: [],
      });

      const createCall = mockPrisma.chatHistory.create.mock.calls[0][0];
      expect(createCall.data.channel).toBe('command');
    });
  });

  describe('findOne', () => {
    it('returns record when found', async () => {
      const record = { id: 'h-1', agentId: 'router' };
      mockPrisma.chatHistory.findUnique.mockResolvedValue(record);

      const result = await service.findOne('h-1');
      expect(result).toEqual(record);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the record and returns it', async () => {
      const record = { id: 'h-1' };
      mockPrisma.chatHistory.findUnique.mockResolvedValue(record);
      mockPrisma.chatHistory.delete.mockResolvedValue(record);

      const result = await service.remove('h-1');
      expect(result).toEqual(record);
      expect(mockPrisma.chatHistory.delete).toHaveBeenCalledWith({ where: { id: 'h-1' } });
    });

    it('throws NotFoundException when record missing', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
