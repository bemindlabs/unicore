import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { InviteParticipantDto, InviteParticipantType } from './dto/invite-participant.dto';

// Known agent types for /invite @<agentType> command resolution
const AGENT_TYPE_MAP: Record<string, { id: string; name: string }> = {
  finance:     { id: 'finance-agent',     name: 'Finance Agent' },
  crm:         { id: 'crm-agent',         name: 'CRM Agent' },
  erp:         { id: 'erp-agent',         name: 'ERP Agent' },
  support:     { id: 'support-agent',     name: 'Support Agent' },
  sales:       { id: 'sales-agent',       name: 'Sales Agent' },
  marketing:   { id: 'marketing-agent',   name: 'Marketing Agent' },
  router:      { id: 'router-agent',      name: 'Router Agent' },
  inventory:   { id: 'inventory-agent',   name: 'Inventory Agent' },
  billing:     { id: 'billing-agent',     name: 'Billing Agent' },
};

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

  // ─── Conversations CRUD ───────────────────────────────────────────────────────

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
      include: {
        messages: true,
        participants: true,
      },
    });

    // Auto-add the creating user as OWNER participant
    await this.prisma.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        participantId: userId,
        participantType: 'USER',
        participantName: 'User',
        role: 'OWNER',
        autoAssigned: false,
        invitedBy: null,
      },
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
          _count: { select: { messages: true, participants: true } },
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

  async findOne(id: string, _userId?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        participants: { orderBy: { joinedAt: 'asc' } },
      },
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
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        participants: { orderBy: { joinedAt: 'asc' } },
      },
    });
  }

  async assign(id: string, assigneeId: string, assigneeName: string) {
    await this.findOne(id);
    return this.prisma.conversation.update({
      where: { id },
      data: { assigneeId, assigneeName, status: 'ASSIGNED' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        participants: { orderBy: { joinedAt: 'asc' } },
      },
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
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        participants: { orderBy: { joinedAt: 'asc' } },
      },
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

  // ─── Participant Management ───────────────────────────────────────────────────

  async listParticipants(conversationId: string) {
    await this.findOne(conversationId);
    return this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async inviteParticipant(
    conversationId: string,
    dto: InviteParticipantDto,
    invitedBy: string,
  ) {
    await this.findOne(conversationId);

    // Check for duplicate active participant
    const existing = await this.prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        participantId: dto.participantId,
        participantType: dto.participantType,
        leftAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `${dto.participantType} "${dto.participantId}" is already a participant`,
      );
    }

    const participant = await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        participantId: dto.participantId,
        participantType: dto.participantType,
        participantName: dto.participantName,
        participantColor: dto.participantColor ?? '#6366f1',
        autoRespond: dto.autoRespond ?? (dto.participantType === InviteParticipantType.AGENT),
        addedBy: invitedBy,
        role: 'MEMBER',
        autoAssigned: dto.autoAssigned ?? false,
        invitedBy,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return participant;
  }

  async removeParticipant(conversationId: string, participantId: string) {
    await this.findOne(conversationId);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, participantId, leftAt: null },
    });

    if (!participant) {
      throw new NotFoundException(
        `Participant "${participantId}" not found in conversation ${conversationId}`,
      );
    }

    return this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date(), isActive: false },
    });
  }

  /** UNC-1031: Toggle autoRespond or update participantColor for an agent participant */
  async updateParticipant(
    conversationId: string,
    participantId: string,
    dto: { autoRespond?: boolean; participantColor?: string },
  ) {
    await this.findOne(conversationId);

    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, participantId, leftAt: null },
    });

    if (!participant) {
      throw new NotFoundException(
        `Participant "${participantId}" not found in conversation ${conversationId}`,
      );
    }

    return this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: {
        ...(dto.autoRespond !== undefined && { autoRespond: dto.autoRespond }),
        ...(dto.participantColor !== undefined && { participantColor: dto.participantColor }),
      },
    });
  }

  /**
   * Parse and execute /invite @agentType commands.
   *
   * Format: `/invite @<agentType>` (e.g. `/invite @finance`)
   * Returns the created participant or throws if the agent type is unknown.
   */
  async processInviteCommand(
    conversationId: string,
    command: string,
    invitedBy: string,
  ) {
    const match = command.trim().match(/^\/invite\s+@(\w+)/i);
    if (!match) {
      throw new BadRequestException(
        'Invalid invite command. Format: /invite @agentType',
      );
    }

    const agentType = match[1].toLowerCase();
    const agentDef = AGENT_TYPE_MAP[agentType];

    if (!agentDef) {
      throw new BadRequestException(
        `Unknown agent type "@${agentType}". Available: ${Object.keys(AGENT_TYPE_MAP).join(', ')}`,
      );
    }

    return this.inviteParticipant(
      conversationId,
      {
        participantId: agentDef.id,
        participantType: InviteParticipantType.AGENT,
        participantName: agentDef.name,
        autoAssigned: false,
      },
      invitedBy,
    );
  }

  /**
   * Auto-assign agents to a conversation via Router Agent logic.
   * Determines the best agent(s) based on conversation channel and metadata.
   */
  async autoAssign(conversationId: string, userId: string) {
    const conversation = await this.findOne(conversationId);

    // Determine default agent based on channel
    const channelAgentMap: Record<string, string> = {
      telegram: 'support-agent',
      whatsapp: 'support-agent',
      line:     'support-agent',
      email:    'crm-agent',
      web:      'router-agent',
      chat:     'router-agent',
    };

    const defaultAgentId = channelAgentMap[conversation.channel] ?? 'router-agent';
    const agentName =
      Object.values(AGENT_TYPE_MAP).find((a) => a.id === defaultAgentId)?.name ??
      'Router Agent';

    // Skip if already assigned
    const already = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, participantType: 'AGENT', leftAt: null },
    });

    if (already) return already;

    return this.inviteParticipant(
      conversationId,
      {
        participantId: defaultAgentId,
        participantType: InviteParticipantType.AGENT,
        participantName: agentName,
        autoAssigned: true,
      },
      userId,
    );
  }
}
