import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AddMessageDto } from './dto/add-message.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN:     ['ASSIGNED', 'PENDING', 'CLOSED'],
  ASSIGNED: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'],
  PENDING:  ['OPEN', 'ASSIGNED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED:   [],
};

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConversationDto) {
    const conversation = await this.prisma.conversation.create({
      data: {
        title: dto.title,
        channel: dto.channel ?? 'web',
        userId,
        contactId: dto.contactId,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
      },
      include: { messages: true },
    });

    if (dto.initialMessage) {
      await this.prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          content: dto.initialMessage,
          role: 'user',
          authorId: userId,
          authorType: 'human',
        },
      });
    }

    return this.findOne(conversation.id, userId);
  }

  async list(options: {
    userId?: string;
    status?: string;
    channel?: string;
    assigneeId?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const take = Math.min(options.limit ?? 50, 100);
    const skip = ((options.page ?? 1) - 1) * take;

    const where: any = {};
    if (options.userId) where.userId = options.userId;
    if (options.status) where.status = options.status;
    if (options.channel) where.channel = options.channel;
    if (options.assigneeId) where.assigneeId = options.assigneeId;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = new Date(options.from);
      if (options.to) where.createdAt.lte = new Date(options.to);
    }
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { contactName: { contains: options.search, mode: 'insensitive' } },
        { contactEmail: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          title: true,
          status: true,
          channel: true,
          assigneeId: true,
          assigneeName: true,
          contactId: true,
          contactName: true,
          contactEmail: true,
          userId: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items,
      total,
      page: options.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async findOne(id: string, userId?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException(`Conversation ${id} not found`);
    return conversation;
  }

  async update(id: string, dto: UpdateConversationDto) {
    await this.findOne(id);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.assigneeName !== undefined && { assigneeName: dto.assigneeName }),
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async assign(id: string, assigneeId: string, assigneeName: string) {
    await this.findOne(id);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        assigneeId,
        assigneeName,
        status: 'ASSIGNED',
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async transition(id: string, targetStatus: string) {
    const conversation = await this.findOne(id);
    const current = conversation.status as string;
    const allowed = VALID_TRANSITIONS[current] ?? [];

    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const data: any = { status: targetStatus };
    if (targetStatus === 'CLOSED') data.closedAt = new Date();
    if (targetStatus === 'OPEN') data.closedAt = null;

    return this.prisma.conversation.update({
      where: { id },
      data,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getHistory(id: string, options: { page?: number; limit?: number } = {}) {
    await this.findOne(id);
    const take = Math.min(options.limit ?? 50, 200);
    const skip = ((options.page ?? 1) - 1) * take;

    const [messages, total] = await Promise.all([
      this.prisma.conversationMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.conversationMessage.count({ where: { conversationId: id } }),
    ]);

    return {
      messages,
      total,
      page: options.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  async addMessage(id: string, authorId: string, dto: AddMessageDto) {
    await this.findOne(id);
    const message = await this.prisma.conversationMessage.create({
      data: {
        conversationId: id,
        content: dto.content,
        role: dto.role ?? 'user',
        authorId: dto.authorId ?? authorId,
        authorName: dto.authorName,
        authorType: dto.authorType ?? 'human',
      },
    });

    await this.prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.conversation.delete({ where: { id } });
  }
}
