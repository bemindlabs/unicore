import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationIntelligenceService } from '../conversation-intelligence/conversation-intelligence.service';

@Injectable()
export class ChatHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly intelligence: ConversationIntelligenceService,
  ) {}

  async list(options: {
    agentId?: string;
    userId?: string;
    channel?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(options.limit ?? 50, 100);
    const skip = ((options.page ?? 1) - 1) * take;

    const where: any = {};
    if (options.agentId) where.agentId = options.agentId;
    if (options.userId) where.userId = options.userId;
    if (options.channel) where.channel = options.channel;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = new Date(options.from);
      if (options.to) where.createdAt.lte = new Date(options.to);
    }
    if (options.search) {
      where.OR = [
        { agentName: { contains: options.search, mode: 'insensitive' } },
        { summary: { contains: options.search, mode: 'insensitive' } },
        { userName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.chatHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        // Exclude messages from list for smaller payloads
        select: {
          id: true,
          agentId: true,
          agentName: true,
          userId: true,
          userName: true,
          summary: true,
          channel: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.chatHistory.count({ where }),
    ]);

    return {
      items,
      total,
      page: options.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async create(data: {
    agentId: string;
    agentName: string;
    userId: string;
    userName: string;
    messages?: Array<{
      id: string;
      text?: string;
      author: string;
      authorId: string;
      authorType?: string;
      authorColor?: string;
      channel?: string;
      timestamp?: string;
      toolCalls?: Array<{ toolName: string; arguments: Record<string, unknown>; result?: unknown; error?: string; status: string }>;
      suggestedActions?: Array<{ label: string; value: string; variant?: string }>;
    }>;
    summary?: string;
    channel?: string;
  }) {
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    const firstHumanMsg = msgs.find((m) => m.authorType === 'human' || m.authorId === 'human-user');
    const autoSummary =
      data.summary ?? (firstHumanMsg?.text ?? '').slice(0, 120);

    const record = await this.prisma.chatHistory.create({
      data: {
        agentId: data.agentId,
        agentName: data.agentName,
        userId: data.userId,
        userName: data.userName,
        messages: msgs,
        summary: autoSummary || null,
        channel: data.channel ?? 'command',
      },
    });

    // Fire-and-forget intelligence analysis
    if (this.intelligence && msgs.length > 0) {
      this.intelligence.analyze(record.id).catch(() => { /* ignore */ });
    }

    return record;
  }

  async findOne(id: string) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    return record;
  }

  async remove(id: string) {
    const record = await this.prisma.chatHistory.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Chat history ${id} not found`);
    await this.prisma.chatHistory.delete({ where: { id } });
    return record;
  }
}
