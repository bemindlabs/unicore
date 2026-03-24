import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../../channels/channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsGateway } from '../conversations.gateway';
import type { SendOutboundDto, SwitchChannelDto } from './dto/send-outbound.dto';
import { OutboundSenderService } from './outbound-sender.service';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const CONVERSATION_ID = 'conv-aaa';

const mockConversation = {
  id: CONVERSATION_ID,
  channel: 'TELEGRAM',
  status: 'OPEN',
  metadata: {},
};

const mockMessage = {
  id: 'msg-001',
  conversationId: CONVERSATION_ID,
  direction: 'OUTBOUND',
  type: 'TEXT',
  content: 'Hello!',
  sender: { id: 'agent-1', name: 'Agent', type: 'bot' },
  externalId: null,
  deliveredAt: null,
  failedAt: null,
  errorMessage: null,
  metadata: { channelType: 'telegram', deliveryStatus: 'pending' },
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const mockMessageDelivered = {
  ...mockMessage,
  externalId: 'tg-42',
  deliveredAt: new Date('2026-01-01T00:00:01Z'),
  metadata: { ...mockMessage.metadata, deliveryStatus: 'delivered' },
};

const mockMessageFailed = {
  ...mockMessage,
  failedAt: new Date('2026-01-01T00:00:01Z'),
  errorMessage: 'Telegram API error 400',
  metadata: { ...mockMessage.metadata, deliveryStatus: 'failed' },
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const prismaMock = {
  conversation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  message: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const channelsMock = {
  send: jest.fn(),
};

const gatewayMock = {
  emitMessageAdded: jest.fn(),
  emitConversationUpdated: jest.fn(),
};

const configMock = {
  get: jest.fn((_key: string, fallback = '') => fallback),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OutboundSenderService', () => {
  let service: OutboundSenderService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboundSenderService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChannelsService, useValue: channelsMock },
        { provide: ConversationsGateway, useValue: gatewayMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<OutboundSenderService>(OutboundSenderService);
  });

  // ─── send() ────────────────────────────────────────────────────────────────

  describe('send()', () => {
    const dto: SendOutboundDto = {
      conversationId: CONVERSATION_ID,
      channelType: 'telegram',
      text: 'Hello!',
      recipientId: '123456',
      fromAgentId: 'agent-1',
    };

    it('throws NotFoundException when conversation does not exist', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null);

      await expect(service.send(dto)).rejects.toThrow(NotFoundException);
      expect(prismaMock.message.create).not.toHaveBeenCalled();
    });

    it('creates an OUTBOUND message record before calling channel adapter', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'tg-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      await service.send(dto);

      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: CONVERSATION_ID,
            direction: 'OUTBOUND',
            type: 'TEXT',
            content: 'Hello!',
          }),
        }),
      );
    });

    it('calls ChannelsService.send with correct arguments', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'tg-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      await service.send(dto);

      expect(channelsMock.send).toHaveBeenCalledWith('telegram', CONVERSATION_ID, 'Hello!', '123456');
    });

    it('updates message with deliveredAt and externalId on success', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'tg-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      const result = await service.send(dto);

      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockMessage.id },
          data: expect.objectContaining({
            externalId: 'tg-42',
            deliveredAt: expect.any(Date),
            failedAt: null,
            errorMessage: null,
          }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.id).toBe(mockMessage.id);
    });

    it('updates message with failedAt and errorMessage on channel failure', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({
        success: false,
        timestamp: '2026-01-01T00:00:00Z',
        error: 'Telegram API error 400',
      });
      prismaMock.message.update.mockResolvedValue(mockMessageFailed);
      prismaMock.conversation.update.mockResolvedValue({});

      const result = await service.send(dto);

      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedAt: expect.any(Date),
            deliveredAt: null,
            errorMessage: 'Telegram API error 400',
          }),
        }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API error 400');
    });

    it('emits WebSocket event after delivery', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'tg-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      await service.send(dto);

      expect(gatewayMock.emitMessageAdded).toHaveBeenCalledWith(CONVERSATION_ID, mockMessageDelivered);
    });

    it('falls back to conversation.channel when dto.channelType is empty', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({ ...mockConversation, channel: 'LINE' });
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      await service.send({ ...dto, channelType: '' });

      expect(channelsMock.send).toHaveBeenCalledWith('line', expect.any(String), expect.any(String), expect.any(String));
    });
  });

  // ─── switchChannel() ───────────────────────────────────────────────────────

  describe('switchChannel()', () => {
    const dto: SwitchChannelDto = {
      conversationId: CONVERSATION_ID,
      newChannelType: 'line',
    };

    it('throws NotFoundException when conversation does not exist', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null);

      await expect(service.switchChannel(dto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for invalid channel type', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);

      await expect(service.switchChannel({ ...dto, newChannelType: 'invalid_xyz' })).rejects.toThrow(NotFoundException);
    });

    it('updates conversation channel and creates SYSTEM message in a transaction', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      const systemMessage = { ...mockMessage, type: 'SYSTEM', content: 'Channel switched from TELEGRAM to LINE' };
      prismaMock.conversation.update.mockReturnValue({});
      prismaMock.message.create.mockReturnValue(systemMessage);
      prismaMock.$transaction.mockResolvedValue([{}, systemMessage]);

      await service.switchChannel(dto);

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONVERSATION_ID },
          data: { channel: 'LINE' },
        }),
      );
      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: CONVERSATION_ID,
            direction: 'OUTBOUND',
            type: 'SYSTEM',
          }),
        }),
      );
    });

    it('emits WebSocket conversation updated and message added events', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      const systemMessage = { ...mockMessage, type: 'SYSTEM' };
      prismaMock.conversation.update.mockReturnValue({});
      prismaMock.message.create.mockReturnValue(systemMessage);
      prismaMock.$transaction.mockResolvedValue([{}, systemMessage]);

      await service.switchChannel(dto);

      expect(gatewayMock.emitConversationUpdated).toHaveBeenCalledWith(
        CONVERSATION_ID,
        expect.objectContaining({ channel: 'LINE' }),
      );
      expect(gatewayMock.emitMessageAdded).toHaveBeenCalledWith(CONVERSATION_ID, systemMessage);
    });
  });

  // ─── retryFailed() ─────────────────────────────────────────────────────────

  describe('retryFailed()', () => {
    it('throws NotFoundException when message does not exist', async () => {
      prismaMock.message.findUnique.mockResolvedValue(null);

      await expect(service.retryFailed('msg-not-found')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for non-outbound messages', async () => {
      prismaMock.message.findUnique.mockResolvedValue({ ...mockMessage, direction: 'INBOUND' });

      await expect(service.retryFailed('msg-001')).rejects.toThrow(NotFoundException);
    });

    it('delegates to send() with original message data', async () => {
      const failedMsg = { ...mockMessageFailed, metadata: { channelType: 'telegram', recipientId: '123' } };
      prismaMock.message.findUnique.mockResolvedValue(failedMsg);
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.message.create.mockResolvedValue(mockMessage);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'tg-99', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.message.update.mockResolvedValue(mockMessageDelivered);
      prismaMock.conversation.update.mockResolvedValue({});

      await service.retryFailed('msg-001');

      expect(channelsMock.send).toHaveBeenCalledWith('telegram', CONVERSATION_ID, 'Hello!', '123');
    });
  });

  // ─── listOutbound() ────────────────────────────────────────────────────────

  describe('listOutbound()', () => {
    it('queries OUTBOUND messages ordered by createdAt desc', async () => {
      prismaMock.message.findMany.mockResolvedValue([mockMessage]);

      const result = await service.listOutbound(CONVERSATION_ID, 20, 0);

      expect(prismaMock.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: CONVERSATION_ID, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toHaveLength(1);
    });
  });
});
