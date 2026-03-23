import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsAnalyticsService } from './conversations-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  conversation: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  conversationParticipant: {
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
    function setupDefaultMocks() {
      // computeSummary: count total, count resolved, groupBy assigneeId, sample resolved
      mockPrisma.conversation.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(75); // resolved

      mockPrisma.conversation.groupBy
        // computeSummary: assignees
        .mockResolvedValueOnce([
          { assigneeId: 'op-1', _count: { assigneeId: 60 } },
          { assigneeId: 'op-2', _count: { assigneeId: 40 } },
        ])
        // computeChannels
        .mockResolvedValueOnce([
          { channel: 'TELEGRAM', _count: { channel: 60 } },
          { channel: 'LINE', _count: { channel: 40 } },
        ])
        // computeAgents: assigneeGroups
        .mockResolvedValueOnce([
          {
            assigneeId: 'op-1',
            _count: { assigneeId: 60 },
            _max: { lastMessageAt: new Date('2026-03-23T10:00:00Z'), createdAt: null },
          },
          {
            assigneeId: 'op-2',
            _count: { assigneeId: 40 },
            _max: { lastMessageAt: new Date('2026-03-22T10:00:00Z'), createdAt: null },
          },
        ]);

      mockPrisma.conversation.findMany
        // computeSummary: resolvedSample
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-03-22T09:00:00Z'),
            resolvedAt: new Date('2026-03-22T09:01:00Z'), // 60 sec
          },
          {
            createdAt: new Date('2026-03-22T10:00:00Z'),
            resolvedAt: new Date('2026-03-22T10:02:00Z'), // 120 sec
          },
        ])
        // computeTrend
        .mockResolvedValueOnce([
          { createdAt: new Date('2026-03-22T10:00:00Z') },
          { createdAt: new Date('2026-03-23T09:00:00Z') },
        ])
        // computeAgents: resolvedConvs
        .mockResolvedValueOnce([
          {
            assigneeId: 'op-1',
            createdAt: new Date('2026-03-22T09:00:00Z'),
            resolvedAt: new Date('2026-03-22T09:01:00Z'),
          },
        ]);

      mockPrisma.conversationParticipant.findMany.mockResolvedValue([
        { participantId: 'op-1', participantName: 'Alice', participantType: 'human' },
        { participantId: 'op-2', participantName: 'Bob', participantType: 'human' },
      ]);
    }

    it('returns structured analytics result', async () => {
      setupDefaultMocks();

      const result = await service.getAnalytics({ days: 7 });

      expect(result.summary.totalConversations).toBe(100);
      expect(result.summary.activeAgents).toBe(2);
      expect(result.summary.resolutionRate).toBe(0.75);
      expect(result.summary.avgResponseTimeSec).toBe(90); // (60+120)/2

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0]).toEqual({
        channel: 'TELEGRAM',
        label: 'Telegram',
        count: 60,
      });
      expect(result.channels[1]).toEqual({
        channel: 'LINE',
        label: 'LINE',
        count: 40,
      });

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].agentName).toBe('Alice');
      expect(result.agents[0].conversations).toBe(60);
      expect(result.agents[0].lastActive).toBe('2026-03-23T10:00:00.000Z');
    });

    it('handles empty data gracefully', async () => {
      mockPrisma.conversation.count.mockResolvedValue(0);
      mockPrisma.conversation.groupBy.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics({ days: 30 });

      expect(result.summary.totalConversations).toBe(0);
      expect(result.summary.resolutionRate).toBe(0);
      expect(result.summary.avgResponseTimeSec).toBe(0);
      expect(result.summary.activeAgents).toBe(0);
      expect(result.channels).toHaveLength(0);
      expect(result.agents).toHaveLength(0);
    });

    it('scopes by assigneeId when provided', async () => {
      mockPrisma.conversation.count.mockResolvedValue(5);
      mockPrisma.conversation.groupBy.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);

      await service.getAnalytics({ assigneeId: 'user-123', days: 7 });

      const countCall = mockPrisma.conversation.count.mock.calls[0][0];
      expect(countCall.where.assigneeId).toBe('user-123');
    });

    it('uses custom from/to date range', async () => {
      mockPrisma.conversation.count.mockResolvedValue(0);
      mockPrisma.conversation.groupBy.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);

      await service.getAnalytics({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-31T23:59:59Z',
      });

      const countCall = mockPrisma.conversation.count.mock.calls[0][0];
      expect(countCall.where.createdAt.gte).toEqual(
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(countCall.where.createdAt.lte).toEqual(
        new Date('2026-01-31T23:59:59Z'),
      );
    });

    it('labels unknown channels with their raw value', async () => {
      mockPrisma.conversation.count.mockResolvedValue(3);
      mockPrisma.conversation.groupBy
        .mockResolvedValueOnce([]) // assignees
        .mockResolvedValueOnce([
          { channel: 'CUSTOM_CHANNEL', _count: { channel: 3 } },
        ]) // channels
        .mockResolvedValueOnce([]); // agents
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics({ days: 7 });

      expect(result.channels[0]).toEqual({
        channel: 'CUSTOM_CHANNEL',
        label: 'CUSTOM_CHANNEL',
        count: 3,
      });
    });

    it('resolution rate is zero when total is zero', async () => {
      mockPrisma.conversation.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0); // resolved
      mockPrisma.conversation.groupBy.mockResolvedValue([]);
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversationParticipant.findMany.mockResolvedValue([]);

      const result = await service.getAnalytics({ days: 7 });

      expect(result.summary.resolutionRate).toBe(0);
    });
  });
});
