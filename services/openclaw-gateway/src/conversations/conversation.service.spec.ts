import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';

const mockPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  conversation: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConversationService],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    (service as unknown as { prisma: typeof mockPrisma }).prisma = mockPrisma;
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('creates a conversation record with default metadata', async () => {
      const expected = {
        id: 'conv-1',
        agentId: 'agent-ops',
        userId: 'user-123',
        userChannel: 'telegram',
        status: 'OPEN',
        assignedTo: null,
        assignedName: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.conversation.create.mockResolvedValue(expected);

      const result = await service.create('conv-1', 'agent-ops', 'user-123', 'telegram');

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          id: 'conv-1',
          agentId: 'agent-ops',
          userId: 'user-123',
          userChannel: 'telegram',
          metadata: {},
        },
      });
      expect(result).toEqual(expected);
    });

    it('passes metadata when provided', async () => {
      mockPrisma.conversation.create.mockResolvedValue({});

      await service.create('conv-2', 'agent-ai', 'user-456', 'web', { source: 'landing' });

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: { source: 'landing' } }),
        }),
      );
    });
  });

  describe('assign', () => {
    it('assigns a conversation and returns updated record', async () => {
      const expected = {
        id: 'conv-1',
        status: 'ASSIGNED',
        assignedTo: 'ops-agent',
        assignedName: 'Ops Agent',
      };
      mockPrisma.conversation.update.mockResolvedValue(expected);

      const result = await service.assign('conv-1', 'ops-agent', 'Ops Agent');

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: 'ASSIGNED', assignedTo: 'ops-agent', assignedName: 'Ops Agent' },
      });
      expect(result).toEqual(expected);
    });

    it('returns null when conversation not found', async () => {
      mockPrisma.conversation.update.mockRejectedValue(new Error('Record not found'));

      const result = await service.assign('ghost-id', 'ops-agent', 'Ops Agent');

      expect(result).toBeNull();
    });
  });

  describe('findByAgent', () => {
    it('returns conversations for an agent in desc order', async () => {
      const expected = [{ id: 'conv-1' }, { id: 'conv-2' }];
      mockPrisma.conversation.findMany.mockResolvedValue(expected);

      const result = await service.findByAgent('agent-ops');

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { agentId: 'agent-ops' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(expected);
    });

    it('respects custom limit', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);

      await service.findByAgent('agent-ops', 10);

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('findById', () => {
    it('returns conversation by id', async () => {
      const expected = { id: 'conv-1', agentId: 'agent-ops' };
      mockPrisma.conversation.findUnique.mockResolvedValue(expected);

      const result = await service.findById('conv-1');

      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
      });
      expect(result).toEqual(expected);
    });

    it('returns null when not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await service.findById('ghost');

      expect(result).toBeNull();
    });
  });
});
