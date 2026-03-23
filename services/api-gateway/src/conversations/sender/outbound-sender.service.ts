import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelsService } from '../../channels/channels.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { OutboundResult, SendOutboundDto, SwitchChannelDto } from './dto/send-outbound.dto';

/**
 * OutboundSenderService (UNC-1018)
 *
 * Responsibilities:
 *  1. Transform a unified SendOutboundDto into a channel-specific payload.
 *  2. Delegate to ChannelsService (channel adapter) to deliver the message.
 *  3. Persist every send attempt as an OutboundMessage record.
 *  4. Notify OpenClaw gateway for real-time WebSocket fanout.
 *  5. Support channel switching (persists a channel_switch sentinel record
 *     and updates the parent Conversation.channel field).
 */
@Injectable()
export class OutboundSenderService {
  private readonly logger = new Logger(OutboundSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly config: ConfigService,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a message to a channel on behalf of a conversation.
   *
   * Flow:
   *   1. Verify the conversation exists.
   *   2. Resolve effective channelType (dto.channelType or conversation.channel).
   *   3. Delegate to ChannelsService.send().
   *   4. Persist OutboundMessage.
   *   5. Fire-and-forget notification to OpenClaw.
   */
  async send(dto: SendOutboundDto): Promise<OutboundResult> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const channelType = dto.channelType || conversation.channel;
    const recipientId = dto.recipientId;

    // Delegate to channel adapter
    const sendResult = await this.channels.send(channelType, dto.conversationId, dto.text, recipientId);

    // Persist the outbound message
    const saved = await this.prisma.outboundMessage.create({
      data: {
        conversationId: dto.conversationId,
        channelType,
        text: dto.text,
        recipientId: recipientId ?? null,
        fromAgentId: dto.fromAgentId ?? null,
        externalId: sendResult.externalId ?? null,
        status: sendResult.success ? 'sent' : 'failed',
        error: sendResult.error ?? null,
        metadata: (dto.metadata ?? {}) as object,
      },
    });

    // Real-time notification (fire-and-forget)
    this.notifyOpenClaw({
      event: 'outbound_message',
      conversationId: dto.conversationId,
      channelType,
      text: dto.text,
      fromAgentId: dto.fromAgentId,
      externalId: sendResult.externalId,
      status: sendResult.success ? 'sent' : 'failed',
      outboundMessageId: saved.id,
      timestamp: saved.createdAt.toISOString(),
    });

    return {
      id: saved.id,
      success: sendResult.success,
      externalId: sendResult.externalId,
      timestamp: sendResult.timestamp,
      error: sendResult.error,
    };
  }

  /**
   * Switch the active channel for a conversation.
   *
   * Updates Conversation.channel, persists a channel_switch sentinel record,
   * and notifies OpenClaw so connected clients receive the channel change.
   */
  async switchChannel(dto: SwitchChannelDto): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const previousChannel = conversation.channel;

    // Update conversation channel in a single transaction
    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { channel: dto.newChannelType },
      }),
      this.prisma.outboundMessage.create({
        data: {
          conversationId: dto.conversationId,
          channelType: dto.newChannelType,
          text: '',
          recipientId: dto.recipientId ?? null,
          status: 'channel_switch',
          metadata: {
            event: 'channel_switch',
            previousChannel,
            newChannelType: dto.newChannelType,
          } as object,
        },
      }),
    ]);

    this.logger.log(
      `Conversation ${dto.conversationId}: channel switched ${previousChannel} → ${dto.newChannelType}`,
    );

    // Notify OpenClaw
    this.notifyOpenClaw({
      event: 'channel_switch',
      conversationId: dto.conversationId,
      previousChannel,
      newChannelType: dto.newChannelType,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * List outbound messages for a conversation (newest first).
   */
  async listForConversation(conversationId: string, limit = 50, offset = 0) {
    return this.prisma.outboundMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Post a JSON event to the OpenClaw outbound-relay endpoint.
   * Runs fire-and-forget — failures are logged but never propagate.
   */
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
      this.logger.warn(`OpenClaw outbound notify failed (${url}): ${err.message}`),
    );
  }
}
