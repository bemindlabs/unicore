import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from '../../channels/channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsGateway } from '../conversations.gateway';
import type { OutboundResult, SendOutboundDto, SwitchChannelDto } from './dto/send-outbound.dto';

/**
 * OutboundSenderService (UNC-1018)
 *
 * Responsibilities:
 *  1. Transform a unified SendOutboundDto into a channel-specific payload.
 *  2. Delegate to ChannelsService (channel adapter) for actual delivery.
 *  3. Persist the send attempt as an OUTBOUND Message record.
 *  4. Update delivery status (externalId / deliveredAt / failedAt / errorMessage).
 *  5. Emit a real-time WebSocket event via ConversationsGateway.
 *  6. Support channel switching (update Conversation.channel + persist a SYSTEM message).
 *  7. Fire-and-forget notification to OpenClaw for multi-agent awareness.
 */
@Injectable()
export class OutboundSenderService {
  private readonly logger = new Logger(OutboundSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly gateway: ConversationsGateway,
    private readonly config: ConfigService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a message to the conversation's current channel.
   *
   * Flow:
   *   1. Verify conversation exists — throw NotFoundException if not.
   *   2. Create OUTBOUND Message record (status = pending in metadata).
   *   3. Call ChannelsService.send() to deliver on the channel.
   *   4. Update Message with delivery result (externalId / deliveredAt / failedAt).
   *   5. Emit `conversation:message` WebSocket event.
   *   6. Fire-and-forget OpenClaw notification.
   */
  async send(dto: SendOutboundDto): Promise<OutboundResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const channelType = dto.channelType || String(conversation.channel).toLowerCase();

    // ── 1. Persist OUTBOUND message record ──────────────────────────────────
    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        direction: 'OUTBOUND' as any,
        type: 'TEXT' as any,
        content: dto.text,
        sender: {
          id: dto.fromAgentId ?? 'system',
          name: dto.fromAgentId ? 'Agent' : 'System',
          type: dto.fromAgentId ? 'bot' : 'operator',
        } as object,
        metadata: {
          ...(dto.metadata ?? {}),
          recipientId: dto.recipientId,
          channelType,
          deliveryStatus: 'pending',
        } as object,
      },
    });

    // ── 2. Deliver via channel adapter ──────────────────────────────────────
    const sendResult = await this.channels.send(channelType, dto.conversationId, dto.text, dto.recipientId);

    // ── 3. Update message with delivery result ───────────────────────────────
    const now = new Date();
    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: {
        externalId: sendResult.externalId ?? null,
        deliveredAt: sendResult.success ? now : null,
        failedAt: sendResult.success ? null : now,
        errorMessage: sendResult.error ?? null,
        metadata: {
          ...(message.metadata as object),
          deliveryStatus: sendResult.success ? 'delivered' : 'failed',
        } as object,
      },
    });

    // Update conversation's lastMessageAt
    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { lastMessageAt: now },
    });

    // ── 4. WebSocket real-time event ─────────────────────────────────────────
    this.gateway.emitMessageAdded(dto.conversationId, updated);

    // ── 5. OpenClaw notification (fire-and-forget) ───────────────────────────
    this.notifyOpenClaw({
      event: 'outbound_message',
      conversationId: dto.conversationId,
      channelType,
      text: dto.text,
      fromAgentId: dto.fromAgentId,
      messageId: updated.id,
      externalId: sendResult.externalId,
      status: sendResult.success ? 'delivered' : 'failed',
      timestamp: now.toISOString(),
    });

    this.logger.log(
      `Outbound message sent: conversation=${dto.conversationId} channel=${channelType} ` +
        `success=${sendResult.success} externalId=${sendResult.externalId ?? 'n/a'}`,
    );

    return {
      id: updated.id,
      success: sendResult.success,
      externalId: sendResult.externalId,
      timestamp: now.toISOString(),
      error: sendResult.error,
    };
  }

  /**
   * Switch the active channel for a conversation.
   *
   * Updates Conversation.channel, creates a SYSTEM message recording the switch,
   * and notifies connected WebSocket clients.
   */
  async switchChannel(dto: SwitchChannelDto): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const previousChannel = String(conversation.channel);
    const newChannel = dto.newChannelType.toUpperCase();

    // Validate target channel against the enum
    const validChannels = [
      'TELEGRAM', 'LINE', 'FACEBOOK', 'INSTAGRAM',
      'WHATSAPP', 'SLACK', 'DISCORD', 'EMAIL', 'SMS', 'LIVE_CHAT',
    ];
    if (!validChannels.includes(newChannel)) {
      throw new NotFoundException(`Channel "${dto.newChannelType}" is not a valid ConversationChannel`);
    }

    // Atomic: update channel + insert SYSTEM message
    const [, systemMessage] = await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { channel: newChannel as any },
      }),
      this.prisma.message.create({
        data: {
          conversationId: dto.conversationId,
          direction: 'OUTBOUND' as any,
          type: 'SYSTEM' as any,
          content: `Channel switched from ${previousChannel} to ${newChannel}`,
          sender: { id: 'system', name: 'System', type: 'operator' } as object,
          metadata: {
            event: 'channel_switch',
            previousChannel,
            newChannel,
            recipientId: dto.recipientId,
          } as object,
        },
      }),
    ]);

    this.logger.log(
      `Conversation ${dto.conversationId}: channel switched ${previousChannel} → ${newChannel}`,
    );

    // WebSocket notification
    this.gateway.emitConversationUpdated(dto.conversationId, {
      channel: newChannel,
      channelSwitch: { previousChannel, newChannel },
    });
    this.gateway.emitMessageAdded(dto.conversationId, systemMessage);

    // OpenClaw notification
    this.notifyOpenClaw({
      event: 'channel_switch',
      conversationId: dto.conversationId,
      previousChannel,
      newChannel,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Retry delivery for a previously failed outbound message.
   */
  async retryFailed(messageId: string): Promise<OutboundResult> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    if ((message.direction as string) !== 'OUTBOUND') {
      throw new NotFoundException(`Message ${messageId} is not an outbound message`);
    }

    const meta = message.metadata as Record<string, unknown>;
    const channelType = (meta['channelType'] as string) ?? 'unknown';
    const recipientId = meta['recipientId'] as string | undefined;

    return this.send({
      conversationId: message.conversationId,
      channelType,
      text: message.content ?? '',
      recipientId,
      metadata: { retryOf: messageId },
    });
  }

  /**
   * List outbound messages for a conversation (newest first).
   */
  async listOutbound(conversationId: string, limit = 50, offset = 0) {
    return this.prisma.message.findMany({
      where: { conversationId, direction: 'OUTBOUND' as any },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private notifyOpenClaw(payload: Record<string, unknown>): void {
    const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
    const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
    const url = `http://${host}:${port}/api/v1/channels/outbound`;

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'api-gateway',
      },
      body: JSON.stringify(payload),
    }).catch((err: Error) =>
      this.logger.warn(`OpenClaw outbound notify failed: ${err.message}`),
    );
  }
}
