import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../../channels/channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SendOutboundDto, SwitchChannelDto } from './dto/send-outbound.dto';
import { OutboundSenderService } from './outbound-sender.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockConversation = {
  id: 'conv-1',
  channel: 'telegram',
  status: 'OPEN',
};

const mockOutboundMessage = {
  id: 'out-1',
  conversationId: 'conv-1',
  channelType: 'telegram',
  text: 'Hello!',
  recipientId: null,
  fromAgentId: null,
  externalId: 'ext-42',
  status: 'sent',
  error: null,
  metadata: {},
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock = {
  conversation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  outboundMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const channelsMock = {
  send: jest.fn(),
};

const configMock = {
  get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OutboundSenderService', () => {
  let service: OutboundSenderService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboundSenderService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ChannelsService, useValue: channelsMock },
        { provide: 'ConfigService', useValue: configMock },
      ],
    })
      .overrideProvider('ConfigService')
      .useValue(configMock)
      .compile();

    // ConfigService token varies — grab it by class name via get
    service = module.get<OutboundSenderService>(OutboundSenderService);
  });

  // ─── send() ────────────────────────────────────────────────────────────────

  describe('send()', () => {
    const dto: SendOutboundDto = {
      conversationId: 'conv-1',
      channelType: 'telegram',
      text: 'Hello!',
      recipientId: '123456',
    };

    it('throws NotFoundException when conversation does not exist', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null);

      await expect(service.send(dto)).rejects.toThrow(NotFoundException);
      expect(prismaMock.outboundMessage.create).not.toHaveBeenCalled();
    });

    it('calls ChannelsService.send with correct arguments', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'ext-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.outboundMessage.create.mockResolvedValue(mockOutboundMessage);

      await service.send(dto);

      expect(channelsMock.send).toHaveBeenCalledWith('telegram', 'conv-1', 'Hello!', '123456');
    });

    it('persists a "sent" outbound message on success', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      channelsMock.send.mockResolvedValue({ success: true, externalId: 'ext-42', timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.outboundMessage.create.mockResolvedValue(mockOutboundMessage);

      const result = await service.send(dto);

      expect(prismaMock.outboundMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-1',
            channelType: 'telegram',
            text: 'Hello!',
            status: 'sent',
            externalId: 'ext-42',
          }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.id).toBe('out-1');
      expect(result.externalId).toBe('ext-42');
    });

    it('persists a "failed" outbound message on channel error', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      channelsMock.send.mockResolvedValue({
        success: false,
        timestamp: '2026-01-01T00:00:00Z',
        error: 'Telegram API error 400',
      });
      prismaMock.outboundMessage.create.mockResolvedValue({
        ...mockOutboundMessage,
        status: 'failed',
        error: 'Telegram API error 400',
        externalId: null,
      });

      const result = await service.send(dto);

      expect(prismaMock.outboundMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed', error: 'Telegram API error 400' }),
        }),
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Telegram API error 400');
    });

    it('falls back to conversation.channel when dto.channelType is empty', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue({ ...mockConversation, channel: 'line' });
      channelsMock.send.mockResolvedValue({ success: true, timestamp: '2026-01-01T00:00:00Z' });
      prismaMock.outboundMessage.create.mockResolvedValue({ ...mockOutboundMessage, channelType: 'line' });

      await service.send({ ...dto, channelType: '' });

      expect(channelsMock.send).toHaveBeenCalledWith('line', expect.any(String), expect.any(String), expect.any(String));
    });
  });

  // ─── switchChannel() ───────────────────────────────────────────────────────

  describe('switchChannel()', () => {
    const dto: SwitchChannelDto = {
      conversationId: 'conv-1',
      newChannelType: 'line',
      recipientId: 'uid-789',
    };

    it('throws NotFoundException when conversation does not exist', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(null);

      await expect(service.switchChannel(dto)).rejects.toThrow(NotFoundException);
    });

    it('updates conversation channel and persists channel_switch record', async () => {
      prismaMock.conversation.findUnique.mockResolvedValue(mockConversation);
      prismaMock.$transaction.mockResolvedValue([]);

      await service.switchChannel(dto);

      expect(prismaMock.$transaction).toHaveBeenCalledWith([
        undefined, // conversation.update result (mocked as undefined)
        undefined, // outboundMessage.create result (mocked as undefined)
      ]);

      expect(prismaMock.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { channel: 'line' },
        }),
      );

      expect(prismaMock.outboundMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-1',
            channelType: 'line',
            status: 'channel_switch',
          }),
        }),
      );
    });
  });

  // ─── listForConversation() ─────────────────────────────────────────────────

  describe('listForConversation()', () => {
    it('queries outbound messages ordered by createdAt desc', async () => {
      prismaMock.outboundMessage.findMany.mockResolvedValue([mockOutboundMessage]);

      const result = await service.listForConversation('conv-1', 20, 0);

      expect(prismaMock.outboundMessage.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('out-1');
    });

    it('applies custom limit and offset', async () => {
      prismaMock.outboundMessage.findMany.mockResolvedValue([]);

      await service.listForConversation('conv-1', 5, 10);

      expect(prismaMock.outboundMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });
  });
});
