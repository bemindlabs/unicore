import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface PersistedMessage {
  id: string;
  messageId: string;
  channel: string;
  fromAgentId: string;
  data: unknown;
  createdAt: Date;
}

@Injectable()
export class MessagePersistenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagePersistenceService.name);
  private readonly prisma = new PrismaClient();

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.log('MessagePersistenceService connected to database');
    } catch (err) {
      this.logger.error(`Failed to connect to database: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /** Persist a single WebSocket message. Fire-and-forget safe — logs errors but never throws. */
  async save(
    messageId: string,
    channel: string,
    fromAgentId: string,
    data: unknown,
  ): Promise<void> {
    try {
      await this.prisma.chatMessage.create({
        data: {
          messageId,
          channel,
          fromAgentId,
          data: data as object,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist message ${messageId}: ${String(err)}`);
    }
  }

  /**
   * Fetch up to `limit` messages for a channel, optionally before a timestamp.
   * Returns messages in ascending order (oldest first).
   */
  async findByChannel(
    channel: string,
    limit: number,
    before?: Date,
  ): Promise<PersistedMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        channel,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse() as PersistedMessage[];
  }

  /**
   * Fetch messages sent after `lastMessageId` on a channel (inclusive boundary excluded).
   * Used for reconnect replay. Returns messages in ascending order.
   * Returns empty array when lastMessageId is not found.
   */
  async findAfterMessageId(
    channel: string,
    lastMessageId: string,
    limit = 100,
  ): Promise<PersistedMessage[]> {
    const ref = await this.prisma.chatMessage.findUnique({
      where: { messageId: lastMessageId },
    });

    if (!ref) {
      this.logger.warn(`Replay requested but lastMessageId "${lastMessageId}" not found — skipping`);
      return [];
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        channel,
        createdAt: { gt: ref.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return rows as PersistedMessage[];
  }
}
