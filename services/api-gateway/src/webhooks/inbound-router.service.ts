import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksGateway } from './webhooks.gateway';

export interface NormalizedMessage {
  channel: string;
  senderId: string;
  senderName?: string;
  text: string;
  rawPayload?: Record<string, unknown>;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * InboundRouterService — centralizes inbound message routing for all channels.
 *
 * Responsibilities:
 *   1. Normalize message fields (defaults for senderName, timestamp)
 *   2. Forward to OpenClaw multi-agent pipeline (fire-and-forget)
 *   3. Broadcast to WebSocket clients via WebhooksGateway for real-time dashboard updates
 */
@Injectable()
export class InboundRouterService {
  private readonly logger = new Logger(InboundRouterService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly gateway?: WebhooksGateway,
  ) {}

  async route(message: NormalizedMessage): Promise<void> {
    const normalized: NormalizedMessage = {
      ...message,
      senderName: message.senderName ?? message.senderId,
      timestamp: message.timestamp ?? new Date().toISOString(),
    };

    this.logger.log(
      `Routing inbound message: channel=${normalized.channel}, senderId=${normalized.senderId}, text="${normalized.text}"`,
    );

    // Broadcast to WebSocket clients for real-time dashboard updates
    this.gateway?.broadcastInbound(normalized);

    // Forward to OpenClaw agent pipeline (fire-and-forget)
    const host = this.config.get<string>('OPENCLAW_SERVICE_HOST') ?? 'unicore-openclaw-gateway';
    const port = this.config.get<string>('OPENCLAW_SERVICE_PORT') ?? '18790';
    const url = `http://${host}:${port}/api/v1/channels/inbound`;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    }).catch((err: unknown) => {
      this.logger.error(
        `Failed to forward message to OpenClaw (channel=${normalized.channel}): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
}
