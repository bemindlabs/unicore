import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

export interface ConversationRecord {
  id: string;
  agentId: string;
  userId: string;
  userChannel: string;
  status: string;
  assignedTo: string | null;
  assignedName: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConversationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConversationService.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.log('ConversationService connected to database');
    } catch (err) {
      this.logger.error(`Failed to connect to database: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async create(
    conversationId: string,
    agentId: string,
    userId: string,
    userChannel: string,
    metadata?: Record<string, unknown>,
  ): Promise<ConversationRecord> {
    return this.prisma.conversation.create({
      data: {
        id: conversationId,
        agentId,
        userId,
        userChannel,
        metadata: (metadata ?? {}) as object,
      },
    }) as Promise<ConversationRecord>;
  }

  async assign(
    conversationId: string,
    assignedTo: string,
    assignedName: string,
  ): Promise<ConversationRecord | null> {
    try {
      return await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'ASSIGNED', assignedTo, assignedName },
      }) as ConversationRecord;
    } catch {
      this.logger.warn(`Conversation ${conversationId} not found for assign`);
      return null;
    }
  }

  async findByAgent(agentId: string, limit = 50): Promise<ConversationRecord[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { agentId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
    return rows as ConversationRecord[];
  }

  async findById(conversationId: string): Promise<ConversationRecord | null> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    return row as ConversationRecord | null;
  }
}
