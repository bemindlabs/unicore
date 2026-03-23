import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteParticipantType } from './dto/invite-participant.dto';

const mockPrisma = {
  conversation: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  conversationMessage: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  conversationParticipant: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    title: 'Test Conversation',
    status: 'OPEN',
    channel: 'web',
    userId: 'user-1',
    assigneeId: null,
    assigneeName: null,
    contactId: null,
    contactName: null,
    contactEmail: null,
    metadata: {},
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    participants: [],
    ...overrides,
  };
}

const mockConfigService = { get: jest.fn().mockReturnValue('localhost') };

describe('ConversationsService', () => {
  let service: ConversationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    jest.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated conversations', async () => {
      const conv = makeConversation();
      mockPrisma.conversation.findMany.mockResolvedValue([conv]);
      mockPrisma.conversation.count.mockResolvedValue(1);

      const result = await service.list({ userId: 'user-1' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('applies status filter', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.list({ status: 'OPEN' });

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'OPEN' }) }),
      );
    });

    it('applies search across title, contactName, contactEmail', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      await service.list({ search: 'john' });

      const call = mockPrisma.conversation.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(3);
    });

    it('caps limit at 100', async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([]);
      mockPrisma.conversation.count.mockResolvedValue(0);

      const result = await service.list({ limit: 500 });
      expect(result.limit).toBe(100);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns conversation with messages and participants', async () => {
      const conv = makeConversation();
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);

      const result = await service.findOne('conv-1');

      expect(result).toEqual(conv);
      expect(mockPrisma.conversation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv-1' },
          include: expect.objectContaining({ messages: expect.anything(), participants: expect.anything() }),
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a conversation and adds the user as OWNER participant', async () => {
      const conv = makeConversation();
      mockPrisma.conversation.create.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.create.mockResolvedValue({ id: 'p-1' });
      // findOne call after creation
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);

      await service.create('user-1', { channel: 'web' });

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(mockPrisma.conversationParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ participantId: 'user-1', role: 'OWNER' }),
        }),
      );
    });

    it('saves initial message when provided', async () => {
      const conv = makeConversation();
      mockPrisma.conversation.create.mockResolvedValue(conv);
      mockPrisma.conversationParticipant.create.mockResolvedValue({ id: 'p-1' });
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: 'm-1' });
      mockPrisma.conversation.findUnique.mockResolvedValue(conv);

      await service.create('user-1', { channel: 'web', initialMessage: 'Hello' });

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: 'Hello', authorId: 'user-1' }),
        }),
      );
    });
  });

  // ─── transition ────────────────────────────────────────────────────────────

  describe('transition', () => {
    it('transitions from OPEN to ASSIGNED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation({ status: 'OPEN' }));
      mockPrisma.conversation.update.mockResolvedValue(makeConversation({ status: 'ASSIGNED' }));

      await service.transition('conv-1', 'ASSIGNED');

      expect(mockPrisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ASSIGNED' }) }),
      );
    });

    it('rejects invalid transitions', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation({ status: 'CLOSED' }));

      await expect(service.transition('conv-1', 'OPEN')).rejects.toThrow(BadRequestException);
    });

    it('sets closedAt when transitioning to CLOSED', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation({ status: 'OPEN' }));
      mockPrisma.conversation.update.mockResolvedValue(makeConversation({ status: 'CLOSED' }));

      await service.transition('conv-1', 'CLOSED');

      const call = mockPrisma.conversation.update.mock.calls[0][0];
      expect(call.data.closedAt).toBeInstanceOf(Date);
    });
  });

  // ─── inviteParticipant ─────────────────────────────────────────────────────

  describe('inviteParticipant', () => {
    it('adds an agent as participant', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1',
        participantId: 'finance-agent',
        participantType: 'AGENT',
        participantName: 'Finance Agent',
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.inviteParticipant(
        'conv-1',
        {
          participantId: 'finance-agent',
          participantType: InviteParticipantType.AGENT,
          participantName: 'Finance Agent',
        },
        'user-1',
      );

      expect(result.participantId).toBe('finance-agent');
      expect(mockPrisma.conversationParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv-1',
            participantId: 'finance-agent',
            participantType: 'AGENT',
            invitedBy: 'user-1',
          }),
        }),
      );
    });

    it('throws ConflictException if participant already active', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-existing' });

      await expect(
        service.inviteParticipant(
          'conv-1',
          {
            participantId: 'finance-agent',
            participantType: InviteParticipantType.AGENT,
            participantName: 'Finance Agent',
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── processInviteCommand ──────────────────────────────────────────────────

  describe('processInviteCommand', () => {
    it('parses /invite @finance and invites the Finance Agent', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1',
        participantId: 'finance-agent',
        participantName: 'Finance Agent',
        participantType: 'AGENT',
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.processInviteCommand('conv-1', '/invite @finance', 'user-1');

      expect(result.participantId).toBe('finance-agent');
    });

    it('is case-insensitive for agent names', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1', participantId: 'crm-agent', participantName: 'CRM Agent', participantType: 'AGENT',
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      await service.processInviteCommand('conv-1', '/invite @CRM', 'user-1');

      expect(mockPrisma.conversationParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ participantId: 'crm-agent' }),
        }),
      );
    });

    it('throws BadRequestException for invalid command format', async () => {
      await expect(
        service.processInviteCommand('conv-1', 'invite finance', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unknown agent type', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());

      await expect(
        service.processInviteCommand('conv-1', '/invite @unknown', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── removeParticipant ─────────────────────────────────────────────────────

  describe('removeParticipant', () => {
    it('soft-deletes participant by setting leftAt', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1', leftAt: null });
      mockPrisma.conversationParticipant.update.mockResolvedValue({ id: 'p-1', leftAt: new Date() });

      await service.removeParticipant('conv-1', 'finance-agent');

      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: expect.objectContaining({ leftAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when participant not found', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(service.removeParticipant('conv-1', 'unknown-agent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── listParticipants (UNC-1031) ─────────────────────────────────────────

  describe('listParticipants', () => {
    it('returns only active participants', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      const participants = [
        { id: 'p-1', participantId: 'user-1', participantType: 'USER', isActive: true, leftAt: null },
        { id: 'p-2', participantId: 'finance-agent', participantType: 'AGENT', isActive: true, leftAt: null },
      ];
      mockPrisma.conversationParticipant.findMany.mockResolvedValue(participants);

      const result = await service.listParticipants('conv-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.conversationParticipant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ conversationId: 'conv-1', leftAt: null }),
        }),
      );
    });
  });

  // ─── inviteParticipant with participantColor (UNC-1031) ────────────────────

  describe('inviteParticipant (UNC-1031 fields)', () => {
    it('persists participantColor when provided', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1',
        participantId: 'finance-agent',
        participantType: 'AGENT',
        participantName: 'Finance Agent',
        participantColor: '#f59e0b',
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      await service.inviteParticipant(
        'conv-1',
        {
          participantId: 'finance-agent',
          participantType: InviteParticipantType.AGENT,
          participantName: 'Finance Agent',
          participantColor: '#f59e0b',
        },
        'user-1',
      );

      expect(mockPrisma.conversationParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participantColor: '#f59e0b',
            invitedBy: 'user-1',
          }),
        }),
      );
    });
  });

  // ─── updateParticipant (UNC-1031) ─────────────────────────────────────────

  describe('updateParticipant', () => {
    it('updates participantColor', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'p-1', participantId: 'finance-agent', participantColor: '#6366f1', leftAt: null,
      });
      mockPrisma.conversationParticipant.update.mockResolvedValue({
        id: 'p-1', participantColor: '#f59e0b',
      });

      const result = await service.updateParticipant('conv-1', 'finance-agent', { participantColor: '#f59e0b' });

      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p-1' },
          data: expect.objectContaining({ participantColor: '#f59e0b' }),
        }),
      );
      expect(result.participantColor).toBe('#f59e0b');
    });

    it('throws NotFoundException when participant not in conversation', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);

      await expect(
        service.updateParticipant('conv-1', 'unknown-agent', { participantColor: '#fff' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeParticipant — isActive flag (UNC-1031) ────────────────────────

  describe('removeParticipant (isActive)', () => {
    it('sets isActive=false when removing', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-1', leftAt: null });
      mockPrisma.conversationParticipant.update.mockResolvedValue({ id: 'p-1', leftAt: new Date(), isActive: false });

      await service.removeParticipant('conv-1', 'finance-agent');

      expect(mockPrisma.conversationParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leftAt: expect.any(Date), isActive: false }),
        }),
      );
    });
  });

  // ─── autoAssign ────────────────────────────────────────────────────────────

  describe('autoAssign', () => {
    it('assigns router-agent for web channel', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation({ channel: 'web' }));
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1', participantId: 'router-agent', participantType: 'AGENT', autoAssigned: true,
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.autoAssign('conv-1', 'user-1');

      expect(result.participantId).toBe('router-agent');
      expect(result.autoAssigned).toBe(true);
    });

    it('assigns support-agent for telegram channel', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation({ channel: 'telegram' }));
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null);
      mockPrisma.conversationParticipant.create.mockResolvedValue({
        id: 'p-1', participantId: 'support-agent', participantType: 'AGENT', autoAssigned: true,
      });
      mockPrisma.conversation.update.mockResolvedValue({});

      const result = await service.autoAssign('conv-1', 'user-1');

      expect(result.participantId).toBe('support-agent');
    });

    it('returns existing agent participant without duplicating', async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(makeConversation());
      const existing = { id: 'p-existing', participantId: 'existing-agent', participantType: 'AGENT' };
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(existing);

      const result = await service.autoAssign('conv-1', 'user-1');

      expect(result).toEqual(existing);
      expect(mockPrisma.conversationParticipant.create).not.toHaveBeenCalled();
    });
  });
});
