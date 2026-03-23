import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHandoffDto } from './dto/handoff.dto';

export const HANDOFF_CONFIDENCE_THRESHOLD = 0.4;
export const HANDOFF_SLA_DEFAULT_MINUTES = 15;

/** Phrases that indicate a user explicitly wants a human agent */
export const EXPLICIT_ESCALATION_PATTERNS = [
  /\btalk to (a |an )?(human|person|agent|support|representative|rep)\b/i,
  /\bspeak (with|to) (a |an )?(human|person|agent|support)\b/i,
  /\bconnect me (to|with) (a |an )?(human|person|agent|support)\b/i,
  /\bhuman support\b/i,
  /\blive (agent|chat|support|help)\b/i,
  /\bescalate\b/i,
  /\bneed (a |an )?(human|person|real person)\b/i,
  /\bnot (helpful|useful|working|what i (need|want))\b/i,
];

@Injectable()
export class HandoffService {
  private readonly logger = new Logger(HandoffService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Detection helpers (used by OpenClaw gateway)
  // ---------------------------------------------------------------------------

  isLowConfidence(confidence: number): boolean {
    return confidence < HANDOFF_CONFIDENCE_THRESHOLD;
  }

  isExplicitEscalation(text: string): boolean {
    return EXPLICIT_ESCALATION_PATTERNS.some((re) => re.test(text));
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateHandoffDto) {
    const slaMinutes = dto.slaMinutes ?? HANDOFF_SLA_DEFAULT_MINUTES;
    const slaDeadline = new Date(Date.now() + slaMinutes * 60 * 1000);

    const handoff = await this.prisma.handoff.create({
      data: {
        channel: dto.channel,
        userId: dto.userId,
        trigger: dto.trigger,
        confidence: dto.confidence ?? null,
        conversationId: dto.conversationId ?? null,
        contextSummary: dto.contextSummary ?? null,
        slaMinutes,
        slaDeadline,
        status: 'pending',
      },
    });

    this.logger.log(
      `Handoff created: ${handoff.id} (trigger=${dto.trigger}, channel=${dto.channel}, sla=${slaMinutes}m)`,
    );

    return handoff;
  }

  async findById(id: string) {
    const handoff = await this.prisma.handoff.findUnique({ where: { id } });
    if (!handoff) throw new NotFoundException(`Handoff ${id} not found`);
    return handoff;
  }

  async findActiveForChannel(channel: string) {
    return this.prisma.handoff.findFirst({
      where: {
        channel,
        status: { in: ['pending', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(options: {
    status?: string;
    assignedTo?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(options.limit ?? 50, 100);
    const skip = ((options.page ?? 1) - 1) * take;

    const where: any = {};
    if (options.status) where.status = options.status;
    if (options.assignedTo) where.assignedTo = options.assignedTo;
    if (options.userId) where.userId = options.userId;

    const [items, total] = await Promise.all([
      this.prisma.handoff.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.handoff.count({ where }),
    ]);

    return {
      items,
      total,
      page: options.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async claim(id: string, operatorId: string) {
    const handoff = await this.findById(id);
    if (handoff.status === 'resolved' || handoff.status === 'ai_resumed') {
      throw new BadRequestException(`Handoff ${id} is already ${handoff.status}`);
    }

    return this.prisma.handoff.update({
      where: { id },
      data: {
        status: 'active',
        assignedTo: operatorId,
      },
    });
  }

  async resolve(id: string) {
    const handoff = await this.findById(id);
    if (handoff.status === 'resolved') {
      throw new BadRequestException(`Handoff ${id} is already resolved`);
    }

    return this.prisma.handoff.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });
  }

  async resumeAI(id: string) {
    const handoff = await this.findById(id);
    if (handoff.status === 'resolved' || handoff.status === 'ai_resumed') {
      throw new BadRequestException(`Handoff ${id} cannot be resumed (status=${handoff.status})`);
    }

    return this.prisma.handoff.update({
      where: { id },
      data: {
        status: 'ai_resumed',
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Mark SLA as breached for all overdue pending/active handoffs.
   * Call this from a scheduled job or on-demand.
   */
  async markSlaBreaches(): Promise<number> {
    const result = await this.prisma.handoff.updateMany({
      where: {
        status: { in: ['pending', 'active'] },
        slaBreached: false,
        slaDeadline: { lt: new Date() },
      },
      data: { slaBreached: true },
    });

    if (result.count > 0) {
      this.logger.warn(`Marked ${result.count} handoff(s) as SLA breached`);
    }

    return result.count;
  }
}
