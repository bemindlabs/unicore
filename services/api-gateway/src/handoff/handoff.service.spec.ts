import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  HandoffService,
  HANDOFF_CONFIDENCE_THRESHOLD,
  EXPLICIT_ESCALATION_PATTERNS,
} from './handoff.service';
import { PrismaService } from '../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Minimal PrismaService mock
// ---------------------------------------------------------------------------
const mockHandoff = {
  id: 'h-1',
  channel: 'chat-agent-router',
  userId: 'u-1',
  trigger: 'low_confidence',
  confidence: 0.2,
  status: 'pending',
  assignedTo: null,
  contextSummary: 'Test summary',
  slaMinutes: 15,
  slaDeadline: new Date(Date.now() + 15 * 60 * 1000),
  slaBreached: false,
  conversationId: null,
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  handoff: {
    create: jest.fn().mockResolvedValue(mockHandoff),
    findUnique: jest.fn().mockResolvedValue(mockHandoff),
    findFirst: jest.fn().mockResolvedValue(mockHandoff),
    findMany: jest.fn().mockResolvedValue([mockHandoff]),
    count: jest.fn().mockResolvedValue(1),
    update: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...mockHandoff, ...data }),
    ),
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HandoffService', () => {
  let service: HandoffService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoffService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HandoffService>(HandoffService);
    jest.clearAllMocks();
  });

  // ── Detection helpers ──────────────────────────────────────────────────────

  describe('isLowConfidence', () => {
    it('returns true when confidence is below threshold', () => {
      expect(service.isLowConfidence(HANDOFF_CONFIDENCE_THRESHOLD - 0.01)).toBe(true);
    });

    it('returns false when confidence meets threshold', () => {
      expect(service.isLowConfidence(HANDOFF_CONFIDENCE_THRESHOLD)).toBe(false);
    });

    it('returns false when confidence is above threshold', () => {
      expect(service.isLowConfidence(0.9)).toBe(false);
    });
  });

  describe('isExplicitEscalation', () => {
    it.each([
      ['talk to a human', true],
      ['I need to speak with an agent', true],
      ['connect me to support', true],
      ['human support please', true],
      ['live agent', true],
      ['escalate this issue', true],
      ['I need a real person', true],
      ['this is not helpful', true],
      ['what is the weather today', false],
      ['can you help me with billing', false],
    ])('"%s" → %s', (text, expected) => {
      expect(service.isExplicitEscalation(text)).toBe(expected);
    });

    it('covers all registered patterns', () => {
      // Sanity check — each pattern in the exported list should match at least one phrase
      const samples = [
        'talk to a human',
        'speak with an agent',
        'connect me to support',
        'human support',
        'live agent',
        'escalate',
        'need a real person',
        'this is not helpful',
      ];
      EXPLICIT_ESCALATION_PATTERNS.forEach((re) => {
        const matched = samples.some((s) => re.test(s));
        expect(matched).toBe(true);
      });
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a handoff with default SLA', async () => {
      const dto = {
        channel: 'chat-agent-router',
        userId: 'u-1',
        trigger: 'low_confidence' as const,
        confidence: 0.2,
      };

      prismaMock.handoff.create.mockResolvedValueOnce(mockHandoff);
      const result = await service.create(dto);

      expect(prismaMock.handoff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: dto.channel,
            userId: dto.userId,
            trigger: dto.trigger,
            confidence: dto.confidence,
            slaMinutes: 15,
            status: 'pending',
          }),
        }),
      );
      expect(result).toEqual(mockHandoff);
    });

    it('uses custom slaMinutes when provided', async () => {
      const dto = {
        channel: 'chat-backoffice',
        userId: 'u-2',
        trigger: 'explicit_request' as const,
        slaMinutes: 30,
      };

      await service.create(dto);

      expect(prismaMock.handoff.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slaMinutes: 30 }),
        }),
      );
    });

    it('sets slaDeadline to approx now + slaMinutes', async () => {
      const before = Date.now();
      await service.create({
        channel: 'ch',
        userId: 'u',
        trigger: 'low_confidence',
        slaMinutes: 10,
      });
      const after = Date.now();

      const { slaDeadline } = prismaMock.handoff.create.mock.calls[0][0].data;
      const deadlineMs = slaDeadline.getTime();
      expect(deadlineMs).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
      expect(deadlineMs).toBeLessThanOrEqual(after + 10 * 60 * 1000);
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns handoff when found', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce(mockHandoff);
      const result = await service.findById('h-1');
      expect(result).toEqual(mockHandoff);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findActiveForChannel ───────────────────────────────────────────────────

  describe('findActiveForChannel', () => {
    it('queries by channel and active statuses', async () => {
      prismaMock.handoff.findFirst.mockResolvedValueOnce(mockHandoff);
      const result = await service.findActiveForChannel('chat-agent-router');

      expect(prismaMock.handoff.findFirst).toHaveBeenCalledWith({
        where: {
          channel: 'chat-agent-router',
          status: { in: ['pending', 'active'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockHandoff);
    });

    it('returns null when no active handoff exists', async () => {
      prismaMock.handoff.findFirst.mockResolvedValueOnce(null);
      const result = await service.findActiveForChannel('empty-channel');
      expect(result).toBeNull();
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns paginated result', async () => {
      prismaMock.handoff.findMany.mockResolvedValueOnce([mockHandoff]);
      prismaMock.handoff.count.mockResolvedValueOnce(1);

      const result = await service.list({ status: 'pending', page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('caps limit at 100', async () => {
      await service.list({ limit: 200 });
      const { take } = prismaMock.handoff.findMany.mock.calls[0][0];
      expect(take).toBe(100);
    });
  });

  // ── claim ──────────────────────────────────────────────────────────────────

  describe('claim', () => {
    it('transitions pending handoff to active and sets assignedTo', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'pending' });
      await service.claim('h-1', 'op-1');

      expect(prismaMock.handoff.update).toHaveBeenCalledWith({
        where: { id: 'h-1' },
        data: { status: 'active', assignedTo: 'op-1' },
      });
    });

    it('throws BadRequestException if already resolved', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'resolved' });
      await expect(service.claim('h-1', 'op-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if already ai_resumed', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'ai_resumed' });
      await expect(service.claim('h-1', 'op-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── resolve ────────────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('transitions handoff to resolved', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'active' });
      await service.resolve('h-1');

      expect(prismaMock.handoff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'h-1' },
          data: expect.objectContaining({ status: 'resolved' }),
        }),
      );
    });

    it('throws BadRequestException if already resolved', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'resolved' });
      await expect(service.resolve('h-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── resumeAI ───────────────────────────────────────────────────────────────

  describe('resumeAI', () => {
    it('transitions active handoff to ai_resumed', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'active' });
      await service.resumeAI('h-1');

      expect(prismaMock.handoff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'h-1' },
          data: expect.objectContaining({ status: 'ai_resumed' }),
        }),
      );
    });

    it('throws BadRequestException if already resolved', async () => {
      prismaMock.handoff.findUnique.mockResolvedValueOnce({ ...mockHandoff, status: 'resolved' });
      await expect(service.resumeAI('h-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── markSlaBreaches ────────────────────────────────────────────────────────

  describe('markSlaBreaches', () => {
    it('updates overdue handoffs and returns count', async () => {
      prismaMock.handoff.updateMany.mockResolvedValueOnce({ count: 3 });
      const count = await service.markSlaBreaches();
      expect(count).toBe(3);
      expect(prismaMock.handoff.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slaBreached: false,
            slaDeadline: { lt: expect.any(Date) },
          }),
          data: { slaBreached: true },
        }),
      );
    });

    it('returns 0 when no breaches', async () => {
      prismaMock.handoff.updateMany.mockResolvedValueOnce({ count: 0 });
      const count = await service.markSlaBreaches();
      expect(count).toBe(0);
    });
  });
});
