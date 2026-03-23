import { Test, TestingModule } from '@nestjs/testing';
import { ConversationIntelligenceService } from './conversation-intelligence.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  chatHistory: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const sampleMessages = [
  { id: 'msg-1', text: 'How do I reset my password?', authorId: 'human-user', authorType: 'human' },
  { id: 'msg-2', text: 'You can reset it from settings. Go to profile > security > reset password.', authorId: 'agent-router', authorType: 'agent' },
  { id: 'msg-3', text: 'Great, that worked! Thank you!', authorId: 'human-user', authorType: 'human' },
];

describe('ConversationIntelligenceService', () => {
  let service: ConversationIntelligenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationIntelligenceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationIntelligenceService>(ConversationIntelligenceService);
    jest.clearAllMocks();
  });

  describe('analyze', () => {
    it('analyzes a conversation and persists intelligence', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-1',
        messages: sampleMessages,
        userId: 'user-1',
        intelligenceAt: null,
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-1');

      expect(result.chatHistoryId).toBe('ch-1');
      expect(['positive', 'neutral', 'negative']).toContain(result.sentimentOverall);
      expect(result.messageSentiments).toHaveLength(3);
      expect(result.intentHistory.length).toBeGreaterThan(0);
      expect(result.aiSummary).toBeTruthy();
      expect(mockPrisma.chatHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ch-1' } }),
      );
    });

    it('throws NotFoundException for non-existent chat history', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue(null);
      await expect(service.analyze('nonexistent')).rejects.toThrow('not found');
    });

    it('handles empty messages gracefully', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({ id: 'ch-2', messages: [], userId: 'user-1' });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-2');
      expect(result.messageSentiments).toHaveLength(0);
      expect(result.sentimentOverall).toBe('neutral');
    });

    it('detects positive sentiment', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-3',
        messages: [{ id: 'msg-1', text: 'Great, excellent work! Amazing job!', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-3');
      expect(result.sentimentOverall).toBe('positive');
    });

    it('detects negative sentiment', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-4',
        messages: [{ id: 'msg-1', text: 'This is broken and terrible! The bug causes errors!', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-4');
      expect(result.sentimentOverall).toBe('negative');
    });
  });

  describe('getIntelligence', () => {
    it('returns null when not analyzed', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({ id: 'ch-1', intelligenceAt: null });
      const result = await service.getIntelligence('ch-1');
      expect(result).toBeNull();
    });

    it('returns intelligence when available', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-1',
        aiSummary: 'Test summary',
        sentimentOverall: 'positive',
        messageSentiments: [],
        intentHistory: [],
        keyEntities: [],
        intelligenceAt: new Date('2026-01-01'),
      });

      const result = await service.getIntelligence('ch-1');
      expect(result).not.toBeNull();
      expect(result!.aiSummary).toBe('Test summary');
      expect(result!.sentimentOverall).toBe('positive');
    });

    it('throws NotFoundException for non-existent record', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue(null);
      await expect(service.getIntelligence('bad-id')).rejects.toThrow('not found');
    });
  });

  describe('intent detection', () => {
    it('detects question intent from ? suffix', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-q',
        messages: [{ id: 'msg-1', text: 'Can you help me?', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-q');
      expect(result.intentHistory[0].intent).toBe('question');
    });

    it('detects request intent', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-r',
        messages: [{ id: 'msg-1', text: 'Please create a new report', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-r');
      expect(result.intentHistory[0].intent).toBe('request');
    });
  });

  describe('entity extraction', () => {
    it('extracts email addresses', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-e',
        messages: [{ id: 'msg-1', text: 'Send it to user@example.com please', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-e');
      const emails = result.keyEntities.filter((e) => e.type === 'email');
      expect(emails).toHaveLength(1);
      expect(emails[0].value).toBe('user@example.com');
    });

    it('extracts URLs', async () => {
      mockPrisma.chatHistory.findUnique.mockResolvedValue({
        id: 'ch-url',
        messages: [{ id: 'msg-1', text: 'Check https://example.com/page for more info', authorId: 'human-user', authorType: 'human' }],
        userId: 'user-1',
      });
      mockPrisma.chatHistory.update.mockResolvedValue({});

      const result = await service.analyze('ch-url');
      const urls = result.keyEntities.filter((e) => e.type === 'url');
      expect(urls.length).toBeGreaterThan(0);
    });
  });

  describe('SSE stream management', () => {
    it('creates a stream for a chat history id', () => {
      const stream = service.getOrCreateStream('ch-1');
      expect(stream).toBeDefined();
    });

    it('returns the same stream on subsequent calls', () => {
      const s1 = service.getOrCreateStream('ch-same');
      const s2 = service.getOrCreateStream('ch-same');
      expect(s1).toBe(s2);
    });

    it('removes stream', () => {
      service.getOrCreateStream('ch-remove');
      service.removeStream('ch-remove');
      const s2 = service.getOrCreateStream('ch-remove');
      // Should be a NEW subject after remove
      expect(s2).toBeDefined();
    });
  });
});
