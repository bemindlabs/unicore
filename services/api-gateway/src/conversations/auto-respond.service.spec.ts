/**
 * Auto-respond integration tests (UNC-1021)
 *
 * Tests the auto-respond flow in ConversationsService:
 *   - setAutoRespond toggles the flag
 *   - handleAutoRespond calls OpenClaw and saves AI message when autoRespond=true
 *   - handleAutoRespond is a no-op when autoRespond=false
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';

const mockConversation = {
  id: 'conv-1',
  autoRespond: true,
  externalId: 'ext-123',
  channel: 'TELEGRAM',
  status: 'OPEN',
  messages: [],
  participants: [],
};

const mockAiMessage = {
  id: 'msg-ai-1',
  conversationId: 'conv-1',
  content: 'Hello from the AI!',
  role: 'assistant',
  authorId: 'router-agent',
  authorName: 'Router Agent',
  authorType: 'agent',
  isAiGenerated: true,
  metadata: {},
  createdAt: new Date('2026-03-23T00:00:00Z'),
};

const mockPrisma = {
  conversation: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    const map: Record<string, string> = {
      OPENCLAW_SERVICE_HOST: 'localhost',
      OPENCLAW_SERVICE_PORT: '18790',
    };
    return map[key] ?? fallback ?? '';
  }),
};

describe('ConversationsService — auto-respond (UNC-1021)', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
  });

  // ─── setAutoRespond ──────────────────────────────────────────────────────────

  describe('setAutoRespond', () => {
    it('enables auto-respond', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValueOnce(mockConversation);
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1', autoRespond: true });

      const result = await service.setAutoRespond('conv-1', true);

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          data: { autoRespond: true },
        }),
      );
      expect(result.autoRespond).toBe(true);
    });

    it('disables auto-respond', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValueOnce(mockConversation);
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1', autoRespond: false });

      const result = await service.setAutoRespond('conv-1', false);

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { autoRespond: false } }),
      );
      expect(result.autoRespond).toBe(false);
    });
  });

  // ─── handleAutoRespond ───────────────────────────────────────────────────────

  describe('handleAutoRespond', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ response: 'Hello from the AI!' }),
      });
    });

    it('returns null when conversation.autoRespond is false', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        autoRespond: false,
      });

      const result = await service.handleAutoRespond('conv-1', 'Hi', 'user-1');
      expect(result).toBeNull();
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('returns null when conversation is not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      const result = await service.handleAutoRespond('nonexistent', 'Hi', 'user-1');
      expect(result).toBeNull();
    });

    it('calls OpenClaw Router Agent with correct payload', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationMessage.create.mockResolvedValue(mockAiMessage);
      mockPrisma.conversation.update.mockResolvedValue(mockConversation);

      await service.handleAutoRespond('conv-1', 'What is the weather?', 'user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/channels/inbound') as string,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"text":"What is the weather?"') as string,
        }) as unknown,
      );
    });

    it('persists AI response as ConversationMessage with isAiGenerated=true', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mockPrisma.conversationMessage.create.mockResolvedValue(mockAiMessage);
      mockPrisma.conversation.update.mockResolvedValue(mockConversation);

      const result = await service.handleAutoRespond('conv-1', 'Hello', 'user-1');

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-1',
            isAiGenerated: true,
            authorType: 'agent',
            role: 'assistant',
          }) as unknown,
        }),
      );
      expect((result as any)?.isAiGenerated).toBe(true);
    });

    it('returns null gracefully when OpenClaw is unreachable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.handleAutoRespond('conv-1', 'Hi', 'user-1');
      expect(result).toBeNull();
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('returns null gracefully when OpenClaw returns non-200', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.handleAutoRespond('conv-1', 'Hi', 'user-1');
      expect(result).toBeNull();
    });
  });
});
