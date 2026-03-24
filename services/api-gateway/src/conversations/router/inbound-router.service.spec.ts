import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InboundRouterService } from './inbound-router.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsGateway } from '../conversations.gateway';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { NormalizedMessageDto } from '../dto/normalized-message.dto';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockConversation = {
  id: 'conv-123',
  channel: 'TELEGRAM',
  externalId: 'chat-456',
  status: 'OPEN',
  assigneeId: null,
  contactName: 'Alice',
  contactId: 'user-789',
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockMessage = {
  id: 'msg-001',
  conversationId: 'conv-123',
  direction: 'INBOUND',
  type: 'TEXT',
  content: 'Hello!',
  externalId: 'tg-msg-1',
  sender: { id: 'user-789', name: 'Alice', type: 'contact' },
<<<<<<< HEAD
  metadata: { channel: 'telegram', rawPayload: {} },
  isRead: false,
  isAiGenerated: false,
=======
  metadata: { channel: 'telegram', rawPayload: {}, routedTo: 'pending' },
>>>>>>> main
  createdAt: new Date(),
};

const mockPrisma = {
  conversation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  message: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  settings: {
    findUnique: jest.fn(),
  },
};

const mockGateway = {
  emitConversationCreated: jest.fn(),
  emitConversationUpdated: jest.fn(),
  emitMessageInbound: jest.fn(),
  emitConversationAssigned: jest.fn(),
  emitConversationClosed: jest.fn(),
};

const mockKafka = {
  publishInbound: jest.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      OPENCLAW_SERVICE_HOST: 'localhost',
      OPENCLAW_SERVICE_PORT: '18790',
    };
    return map[key];
  }),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InboundRouterService', () => {
  let service: InboundRouterService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboundRouterService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConversationsGateway, useValue: mockGateway },
        { provide: KafkaProducerService, useValue: mockKafka },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<InboundRouterService>(InboundRouterService);
  });

  // ─── findOrCreateConversation ───────────────────────────────────────────────

  describe('findOrCreateConversation', () => {
    it('returns existing conversation when found', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.findOrCreateConversation(
        'TELEGRAM',
        'chat-456',
        'Alice',
        'user-789',
      );

      expect(result).toEqual(mockConversation);
      expect(mockPrisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a new conversation when none exists', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      mockPrisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.findOrCreateConversation(
        'TELEGRAM',
        'chat-456',
        'Alice',
        'user-789',
      );

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          channel: 'TELEGRAM',
          externalId: 'chat-456',
          status: 'OPEN',
          contactName: 'Alice',
          contactId: 'user-789',
          lastMessageAt: expect.any(Date) as Date,
        },
      });
      expect(result).toEqual(mockConversation);
      expect(mockGateway.emitConversationCreated).toHaveBeenCalledWith(mockConversation);
    });
  });

  // ─── saveMessage ────────────────────────────────────────────────────────────

  describe('saveMessage', () => {
    const dto: NormalizedMessageDto = {
      channel: 'telegram',
      conversationExternalId: 'chat-456',
      senderId: 'user-789',
      senderName: 'Alice',
      text: 'Hello!',
      externalMessageId: 'tg-msg-1',
      rawPayload: {},
    };

<<<<<<< HEAD
    it('creates a new message in the message table', async () => {
=======
    it('creates a new message', async () => {
>>>>>>> main
      mockPrisma.message.findFirst.mockResolvedValue(null);
      mockPrisma.message.create.mockResolvedValue(mockMessage);

      const result = await service.saveMessage('conv-123', dto);

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-123',
          direction: 'INBOUND',
          type: 'TEXT',
          content: 'Hello!',
          externalId: 'tg-msg-1',
<<<<<<< HEAD
          sender: { id: 'user-789', name: 'Alice', type: 'contact' },
=======
>>>>>>> main
        }) as unknown,
      });
      expect(result).toEqual(mockMessage);
    });

    it('returns existing message when externalMessageId is a duplicate', async () => {
      mockPrisma.message.findFirst.mockResolvedValue(mockMessage);

      const result = await service.saveMessage('conv-123', dto);

      expect(mockPrisma.message.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockMessage);
    });

    it('creates message without dedup check when no externalMessageId', async () => {
      const dtoNoId = { ...dto, externalMessageId: undefined };
<<<<<<< HEAD
      mockPrisma.message.create.mockResolvedValue({ ...mockMessage, externalId: null });
=======
      mockPrisma.message.create.mockResolvedValue({ ...mockMessage, externalMessageId: null });
>>>>>>> main

      await service.saveMessage('conv-123', dtoNoId);

      expect(mockPrisma.message.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.message.create).toHaveBeenCalled();
    });
  });

  // ─── route ──────────────────────────────────────────────────────────────────

  describe('route', () => {
    const dto: NormalizedMessageDto = {
      channel: 'telegram',
      conversationExternalId: 'chat-456',
      senderId: 'user-789',
      senderName: 'Alice',
      text: 'Hello!',
    };

    beforeEach(() => {
      mockPrisma.conversation.findFirst.mockResolvedValue(mockConversation);
      mockPrisma.message.findFirst.mockResolvedValue(null);
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue(mockConversation);
<<<<<<< HEAD
=======
      mockPrisma.message.updateMany.mockResolvedValue({ count: 1 });
>>>>>>> main
      mockPrisma.settings.findUnique.mockResolvedValue(null);

      // Mock fetch globally
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    it('routes to unassigned when no agent is configured', async () => {
      const result = await service.route(dto);

      expect(result.routedTo).toBe('unassigned');
      expect(result.conversationId).toBe('conv-123');
      expect(result.messageId).toBe('msg-001');
      expect(mockKafka.publishInbound).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'conv-123',
          channel: 'telegram',
          routedTo: 'unassigned',
        }) as unknown,
      );
      expect(mockGateway.emitMessageInbound).toHaveBeenCalled();
    });

<<<<<<< HEAD
    it('routes to assigned agent when conversation has assigneeId', async () => {
=======
    it('routes to assigned agent when conversation has assignedAgentId', async () => {
>>>>>>> main
      const assignedConversation = { ...mockConversation, assigneeId: 'agent-42', status: 'ASSIGNED' };
      mockPrisma.conversation.findFirst.mockResolvedValue(assignedConversation);

      const result = await service.route(dto);

      expect(result.routedTo).toBe('agent');
      expect(result.agentId).toBe('agent-42');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/channels/inbound') as string,
        expect.objectContaining({ method: 'POST' }) as unknown,
      );
    });

    it('auto-assigns to default agent from settings', async () => {
      mockPrisma.settings.findUnique.mockResolvedValue({
        id: 'default',
        data: { conversations: { defaultAgentId: 'default-agent-1' } },
      });
      mockPrisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        assigneeId: 'default-agent-1',
        status: 'ASSIGNED',
      });

      const result = await service.route(dto);

      expect(result.routedTo).toBe('agent');
      expect(result.agentId).toBe('default-agent-1');
      expect(mockGateway.emitConversationAssigned).toHaveBeenCalledWith(
        'conv-123',
        'default-agent-1',
      );
    });

    it('publishes Kafka event on every message', async () => {
      await service.route(dto);

      expect(mockKafka.publishInbound).toHaveBeenCalledTimes(1);
      expect(mockKafka.publishInbound).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-001',
          channel: 'telegram',
          senderId: 'user-789',
          text: 'Hello!',
        }) as unknown,
      );
    });

    it('emits WebSocket message.inbound event', async () => {
      await service.route(dto);

      expect(mockGateway.emitMessageInbound).toHaveBeenCalledWith(
        'conv-123',
        expect.objectContaining({
          channel: 'telegram',
          senderId: 'user-789',
          text: 'Hello!',
        }) as unknown,
      );
    });
  });
});
