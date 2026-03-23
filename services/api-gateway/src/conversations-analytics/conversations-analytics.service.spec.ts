import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsAnalyticsService } from './conversations-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-03-23T12:00:00Z');

const mockPrisma = {
  chatHistory: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ConversationsAnalyticsService', () => {
  let service: ConversationsAnalyticsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsAnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationsAnalyticsService>(
      ConversationsAnalyticsService,
    );
  });

  describe('getAnalytics', () => {
    it('returns structured analytics result', async () => {
      mockPrisma.chatHistory.count.mockResolvedValue(42);
      mockPrisma.chatHistory.groupBy
        // computeSummary: groupBy agentId
        .mockResolvedValueOnce([{ agentId: 'agent-1', _count: { agentId: 42 } }])
        // computeChannels: groupBy channel
        .mockResolvedValueOnce([
          { channel: 'command', _count: { channel: 30 } },
          { channel: 'telegram', _count: { channel: 12 } },
        ])
        // computeAgents: groupBy agentId+agentName
        .mockResolvedValueOnce([
          { agentId: 'agent-1', agentName: 'Router', _count: { agentId: 42 } },
        ]);
      mockPrisma.chatHistory.findMany
        // computeSummary sample
        .mockResolvedValueOnce([
          {
            summary: 'resolved',
            messages: [
              { authorId: 'human-user', timestamp: '2026-03-22T10:00:00Z' },
              { authorId: 'agent-1', timestamp: '2026-03-22T10:00:10Z' },
            ],
          },
          {
            summary: null,
            messages: [
              { authorId: 'human-user', timestamp: '2026-03-22T11:00:00Z' },
            ],
          },
        ])
        // computeTrend
        .mockResolvedValueOnce([
          { createdAt: new Date('2026-03-22T10:00:00Z') },
          { createdAt: new Date('2026-03-23T09:00:00Z') },
        ])
        // computeAgents lastActives
        .mockResolvedValueOnce([
          {
            agentId: 'agent-1',
            createdAt: new Date('2026-03-23T09:00:00Z'),
            messages: [{ authorId: 'human-user' }, { authorId: 'agent-1' }],
          },
        ]);

      const result = await service.getAnalytics({ days: 7 });

      expect(result.summary.totalConversations).toBe(42);
      expect(result.summary.activeAgents).toBe(1);
      expect(result.summary.resolutionRate).toBe(0.5);
      expect(result.summary.avgResponseTimeSec).toBe(10);

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0]).toEqual({
        channel: 'command',
        label: 'Commander',
        count: 30,
      });
      expect(result.channels[1]).toEqual({
        channel: 'telegram',
        label: 'Telegram',
        count: 12,
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].agentName).toBe('Router');
      expect(result.agents[0].conversations).toBe(42);
      expect(result.agents[0].avgMessages).toBe(2);
    });

    it('handles empty data gracefully', async () => {
      mockPrisma.chatHistory.count.mockResolvedValue(0);
      mockPrisma.chatHistory.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.chatHistory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getAnalytics({ days: 30 });

      expect(result.summary.totalConversations).toBe(0);
      expect(result.summary.resolutionRate).toBe(0);
      expect(result.summary.avgResponseTimeSec).toBe(0);
      expect(result.summary.activeAgents).toBe(0);
      expect(result.channels).toHaveLength(0);
      expect(result.agents).toHaveLength(0);
    });

    it('scopes by userId when provided', async () => {
      mockPrisma.chatHistory.count.mockResolvedValue(5);
      mockPrisma.chatHistory.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.chatHistory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getAnalytics({ userId: 'user-123', days: 7 });

      const countCall = mockPrisma.chatHistory.count.mock.calls[0][0];
      expect(countCall.where.userId).toBe('user-123');
    });

    it('uses custom from/to date range', async () => {
      mockPrisma.chatHistory.count.mockResolvedValue(0);
      mockPrisma.chatHistory.groupBy
        .mockResolvedValue([]);
      mockPrisma.chatHistory.findMany.mockResolvedValue([]);

      await service.getAnalytics({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-31T23:59:59Z',
      });

      const countCall = mockPrisma.chatHistory.count.mock.calls[0][0];
      expect(countCall.where.createdAt.gte).toEqual(new Date('2026-01-01T00:00:00Z'));
      expect(countCall.where.createdAt.lte).toEqual(new Date('2026-01-31T23:59:59Z'));
    });

    it('labels unknown channels with their raw value', async () => {
      mockPrisma.chatHistory.count.mockResolvedValue(3);
      mockPrisma.chatHistory.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { channel: 'whatsapp', _count: { channel: 3 } },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.chatHistory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getAnalytics({ days: 7 });

      expect(result.channels[0]).toEqual({
        channel: 'whatsapp',
        label: 'whatsapp',
        count: 3,
      });
    });
  });
});
