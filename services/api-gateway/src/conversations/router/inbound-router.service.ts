import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsGateway } from '../conversations.gateway';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { NormalizedMessageDto } from '../dto/normalized-message.dto';
import { ConversationChannel } from '../../generated/prisma';

export type ConversationStatus = 'unassigned' | 'assigned' | 'open' | 'closed';

export interface RouteResult {
  conversationId: string;
  messageId: string;
  routedTo: 'agent' | 'unassigned';
  agentId?: string;
}

/**
 * InboundRouterService — core of the Omni-Channel Conversation Hub.
 *
 * Responsibilities:
 *   1. Receive a normalized inbound message (any channel)
 *   2. Find or create a Conversation record (keyed by channel + externalId)
 *   3. Persist the InboundMessage
 *   4. Publish a `chat.message.inbound` event to Kafka
 *   5. Forward to OpenClaw AI agent OR mark as unassigned
 *   6. Broadcast real-time updates via WebSocket
 */
@Injectable()
export class InboundRouterService {
  private readonly logger = new Logger(InboundRouterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaProducerService,
    private readonly gateway: ConversationsGateway,
    private readonly config: ConfigService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Route a normalized inbound message through the full pipeline:
   * find/create conversation → save message → publish to Kafka → route.
   */
  async route(msg: NormalizedMessageDto): Promise<RouteResult> {
    // 1. Find or create conversation
    const conversation = await this.findOrCreateConversation(
      msg.channel,
      msg.conversationExternalId,
      msg.senderName ?? msg.senderId,
      msg.senderId,
    );

    // 2. Save the inbound message
    const savedMsg = await this.saveMessage(conversation.id, msg);

    // 3. Update conversation's last message timestamp
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // 4. Publish to Kafka (fire-and-forget, graceful degradation)
    const routedTo: 'agent' | 'unassigned' = conversation.assigneeId ? 'agent' : 'unassigned';
    const kafkaEvent = {
      conversationId: conversation.id,
      messageId: savedMsg.id,
      channel: msg.channel,
      senderId: msg.senderId,
      senderName: msg.senderName ?? msg.senderId,
      text: msg.text,
      timestamp: new Date().toISOString(),
      routedTo,
      agentId: conversation.assigneeId ?? undefined,
      rawPayload: msg.rawPayload,
    };
    void this.kafka.publishInbound(kafkaEvent);

    // 5. Broadcast real-time update via WebSocket
    this.gateway.emitMessageInbound(conversation.id, {
      id: savedMsg.id,
      channel: msg.channel,
      senderId: msg.senderId,
      senderName: msg.senderName ?? msg.senderId,
      text: msg.text,
      createdAt: savedMsg.createdAt,
    });

    // 6. Route to AI agent or unassigned queue
    if (conversation.assigneeId) {
      await this.routeToAgent(conversation.id, conversation.assigneeId, msg);
    } else {
      const defaultAgentId = await this.getDefaultAgentId();
      if (defaultAgentId) {
        await this.assignAndRoute(conversation.id, defaultAgentId, msg);
        return { conversationId: conversation.id, messageId: savedMsg.id, routedTo: 'agent', agentId: defaultAgentId };
      }
      await this.routeToUnassigned(conversation.id);
    }

    return {
      conversationId: conversation.id,
      messageId: savedMsg.id,
      routedTo,
      agentId: conversation.assigneeId ?? undefined,
    };
  }

  // ─── Conversation management ─────────────────────────────────────────────────

  /**
   * Find an existing open conversation by (channel, externalId) or create a new one.
   * A conversation is "open" when status is not 'closed'.
   */
  async findOrCreateConversation(
    channel: string,
    externalId: string,
    contactName: string,
    contactId: string,
  ) {
    const channelEnum = channel as ConversationChannel;
    // Look for an existing non-closed conversation on this channel+externalId
    const existing = await this.prisma.conversation.findFirst({
      where: {
        channel: channelEnum,
        externalId,
        status: { not: 'CLOSED' },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    // Create a new conversation
    const created = await this.prisma.conversation.create({
      data: {
        channel: channelEnum,
        externalId,
        status: 'OPEN',
        contactName,
        contactId,
        lastMessageAt: new Date(),
      },
    });

    this.logger.log(
      `New conversation created: id=${created.id}, channel=${channel}, externalId=${externalId}`,
    );

    // Broadcast new conversation via WebSocket
    this.gateway.emitConversationCreated(created as unknown as Record<string, unknown>);

    return created;
  }

  // ─── Message persistence ─────────────────────────────────────────────────────

  /**
   * Persist an inbound message to the InboundMessage table.
   * Deduplicates by externalMessageId if provided.
   */
  async saveMessage(conversationId: string, msg: NormalizedMessageDto) {
    // Deduplication: skip if we've already seen this externalMessageId
    if (msg.externalMessageId) {
      const dup = await this.prisma.message.findFirst({
        where: { externalId: msg.externalMessageId, conversationId },
      });
      if (dup) {
        this.logger.debug(
          `Duplicate message skipped: externalId=${msg.externalMessageId}`,
        );
        return dup;
      }
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        direction: 'INBOUND',
        type: 'TEXT',
        content: msg.text,
        externalId: msg.externalMessageId,
        sender: {
          id: msg.senderId,
          name: msg.senderName ?? msg.senderId,
          type: 'contact',
        } as unknown as import('../../generated/prisma').Prisma.InputJsonValue,
        metadata: {
          channel: msg.channel,
          rawPayload: msg.rawPayload ?? {},
          routedTo: 'pending',
        } as unknown as import('../../generated/prisma').Prisma.InputJsonValue,
      },
    });
  }

  // ─── Routing ─────────────────────────────────────────────────────────────────

  /**
   * Route message to the AI agent via OpenClaw.
   */
  private async routeToAgent(
    conversationId: string,
    agentId: string,
    msg: NormalizedMessageDto,
  ): Promise<void> {
    const openclawHost =
      this.config.get<string>('OPENCLAW_SERVICE_HOST') ?? 'unicore-openclaw-gateway';
    const openclawPort =
      this.config.get<string>('OPENCLAW_SERVICE_PORT') ?? '18790';
    const url = `http://${openclawHost}:${openclawPort}/api/v1/channels/inbound`;

    const payload = {
      channel: msg.channel,
      conversationId,
      agentId,
      senderId: msg.senderId,
      senderName: msg.senderName ?? msg.senderId,
      text: msg.text,
      timestamp: new Date().toISOString(),
      rawPayload: msg.rawPayload ?? {},
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err: unknown) => {
      this.logger.error(
        `Failed to forward message to OpenClaw agent (agentId=${agentId}): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    });

    this.logger.log(`Routed conversationId=${conversationId} → agent=${agentId}`);
  }

  /**
   * Assign conversation to a default agent and route.
   */
  private async assignAndRoute(
    conversationId: string,
    agentId: string,
    msg: NormalizedMessageDto,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assigneeId: agentId, status: 'ASSIGNED' },
    });

    this.gateway.emitConversationAssigned(conversationId, agentId);

    await this.routeToAgent(conversationId, agentId, msg);
  }

  /**
   * Mark the conversation as unassigned (waiting for human or agent pickup).
   */
  private async routeToUnassigned(conversationId: string): Promise<void> {
    await this.prisma.inboundMessage.updateMany({
      where: { conversationId, routedTo: 'pending' },
      data: { routedTo: 'unassigned' },
    });

    this.logger.log(
      `Conversation ${conversationId} placed in unassigned queue`,
    );
  }

  // ─── Settings helpers ─────────────────────────────────────────────────────────

  /**
   * Load the configured default agent ID from the Settings table.
   * Returns null if not configured.
   */
  private async getDefaultAgentId(): Promise<string | null> {
    try {
      const row = await this.prisma.settings.findUnique({ where: { id: 'default' } });
      if (!row) return null;
      const data = row.data as Record<string, unknown>;
      const agentId = (data['conversations'] as Record<string, unknown> | undefined)?.[
        'defaultAgentId'
      ];
      return typeof agentId === 'string' && agentId.length > 0 ? agentId : null;
    } catch {
      return null;
    }
  }
}
