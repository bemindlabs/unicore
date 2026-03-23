import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpsertContactChannelDto } from './dto/upsert-contact-channel.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Conversations ────────────────────────────────────────────────────────

  async list(filters: { channel?: string; status?: string; assigneeId?: string } = {}) {
    const where: any = {};
    if (filters.channel) where.channel = filters.channel;
    if (filters.status) where.status = filters.status;
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          contactChannel: true,
          participants: true,
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  async findOne(id: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        contactChannel: true,
        participants: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });
    if (!conv) throw new NotFoundException(`Conversation ${id} not found`);
    return conv;
  }

  async create(dto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: {
        channel: dto.channel as any,
        subject: dto.subject,
        externalId: dto.externalId,
        assigneeId: dto.assigneeId,
        contactChannelId: dto.contactChannelId,
      },
      include: { contactChannel: true },
    });
  }

  async assign(id: string, assigneeId: string | null) {
    await this.ensureExists(id);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        assigneeId,
        status: assigneeId ? ('ASSIGNED' as any) : ('OPEN' as any),
      },
    });
  }

  async resolve(id: string) {
    await this.ensureExists(id);
    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'RESOLVED' as any, resolvedAt: new Date() },
    });
  }

  async close(id: string) {
    await this.ensureExists(id);
    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'CLOSED' as any, closedAt: new Date() },
    });
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  async listMessages(conversationId: string, cursor?: string, limit = 50) {
    await this.ensureExists(conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit,
    });
    return { messages, nextCursor: messages.length === limit ? messages[messages.length - 1].id : null };
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, direction: 'INBOUND' | 'OUTBOUND' = 'OUTBOUND') {
    await this.ensureExists(conversationId);
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: direction as any,
        type: (dto.type ?? 'TEXT') as any,
        content: dto.content,
        attachments: dto.attachments ?? [],
        sender: dto.sender ?? {},
        metadata: dto.metadata ?? {},
      },
    });

    // Update conversation's lastMessageAt
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });

    return message;
  }

  async markRead(conversationId: string, messageId: string) {
    await this.ensureExists(conversationId);
    return this.prisma.message.updateMany({
      where: { id: messageId, conversationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ─── ContactChannels ─────────────────────────────────────────────────────

  async upsertContactChannel(dto: UpsertContactChannelDto) {
    return this.prisma.contactChannel.upsert({
      where: { channel_externalId: { channel: dto.channel as any, externalId: dto.externalId } },
      create: {
        channel: dto.channel as any,
        externalId: dto.externalId,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        metadata: dto.metadata ?? {},
        erpContactId: dto.erpContactId,
      },
      update: {
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        metadata: dto.metadata ?? {},
        erpContactId: dto.erpContactId,
      },
    });
  }

  async listContactChannels(channel?: string) {
    const where: any = channel ? { channel } : {};
    return this.prisma.contactChannel.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  // ─── Participants ─────────────────────────────────────────────────────────

  async addParticipant(conversationId: string, userId: string, role = 'operator') {
    await this.ensureExists(conversationId);
    return this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, role },
      update: { role, leftAt: null },
    });
  }

  async removeParticipant(conversationId: string, userId: string) {
    await this.ensureExists(conversationId);
    return this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { leftAt: new Date() },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async ensureExists(id: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id }, select: { id: true } });
    if (!conv) throw new NotFoundException(`Conversation ${id} not found`);
  }
}
