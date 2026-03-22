import { Test, TestingModule } from '@nestjs/testing';
import { MessagePersistenceService, PersistedMessage } from './message-persistence.service';
import { PrismaClient } from '../generated/prisma';

const mockChatMessage = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
};

jest.mock('../generated/prisma', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(function (this: Record<string, unknown>) {
      this.$connect = jest.fn();
      this.$disconnect = jest.fn();
      this.chatMessage = mockChatMessage;
    }),
  };
});

const getPrismaInstance = (): InstanceType<typeof PrismaClient> => {
  const MockPrisma = PrismaClient as jest.MockedClass<typeof PrismaClient>;
  return MockPrisma.mock.instances[0] as unknown as InstanceType<typeof PrismaClient>;
};

describe('MessagePersistenceService', () => {
  let service: MessagePersistenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagePersistenceService],
    }).compile();

    service = module.get<MessagePersistenceService>(MessagePersistenceService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('save', () => {
    it('creates a chat message record', async () => {
      const prisma = getPrismaInstance();
      (prisma.chatMessage.create as jest.Mock).mockResolvedValue({});

      await service.save('msg-1', 'chat-backoffice', 'dashboard-ui', { text: 'Hello' });

      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          messageId: 'msg-1',
          channel: 'chat-backoffice',
          fromAgentId: 'dashboard-ui',
          data: { text: 'Hello' },
        },
      });
    });

    it('swallows DB errors without throwing', async () => {
      const prisma = getPrismaInstance();
      (prisma.chatMessage.create as jest.Mock).mockRejectedValue(new Error('DB down'));

      await expect(
        service.save('msg-1', 'chat-backoffice', 'dashboard-ui', {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('findByChannel', () => {
    it('returns messages in ascending order (oldest first)', async () => {
      const prisma = getPrismaInstance();
      const rows: Partial<PersistedMessage>[] = [
        { id: '2', messageId: 'm2', channel: 'ch', fromAgentId: 'a', data: {}, createdAt: new Date('2026-01-02') },
        { id: '1', messageId: 'm1', channel: 'ch', fromAgentId: 'a', data: {}, createdAt: new Date('2026-01-01') },
      ];
      // prisma returns descending; service reverses to ascending (oldest first)
      (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue(rows);

      const result = await service.findByChannel('ch', 50);

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { channel: 'ch' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      // reversed → oldest first (m1 Jan-01 before m2 Jan-02)
      expect(result[0].messageId).toBe('m1');
      expect(result[1].messageId).toBe('m2');
    });

    it('applies before-timestamp filter', async () => {
      const prisma = getPrismaInstance();
      (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue([]);
      const before = new Date('2026-03-01');

      await service.findByChannel('ch', 10, before);

      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel: 'ch', createdAt: { lt: before } } }),
      );
    });
  });

  describe('findAfterMessageId', () => {
    it('returns messages after the reference message', async () => {
      const prisma = getPrismaInstance();
      const ref = { id: 'r', messageId: 'ref-msg', channel: 'ch', createdAt: new Date('2026-01-01') };
      const later: Partial<PersistedMessage>[] = [
        { id: '2', messageId: 'm2', channel: 'ch', fromAgentId: 'a', data: {}, createdAt: new Date('2026-01-02') },
      ];
      (prisma.chatMessage.findUnique as jest.Mock).mockResolvedValue(ref);
      (prisma.chatMessage.findMany as jest.Mock).mockResolvedValue(later);

      const result = await service.findAfterMessageId('ch', 'ref-msg');

      expect(prisma.chatMessage.findUnique).toHaveBeenCalledWith({ where: { messageId: 'ref-msg' } });
      expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: { channel: 'ch', createdAt: { gt: ref.createdAt } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('m2');
    });

    it('returns empty array when lastMessageId not found', async () => {
      const prisma = getPrismaInstance();
      (prisma.chatMessage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findAfterMessageId('ch', 'ghost-id');

      expect(result).toEqual([]);
      expect(prisma.chatMessage.findMany).not.toHaveBeenCalled();
    });
  });
});
