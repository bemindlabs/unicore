import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { RouterAgent } from '../router/router.agent';

export interface ChannelInboundPayload {
  conversationId?: string;
  senderId: string;
  senderName?: string;
  text: string;
  channel?: string;
  timestamp?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * ChannelsController (OpenClaw, UNC-1021)
 *
 * HTTP endpoint on port 18790 that receives inbound channel messages from the
 * API Gateway and routes them through the RouterAgent pipeline.
 *
 * POST /api/v1/channels/inbound
 *   ← { conversationId, senderId, senderName, text, channel, ... }
 *   → { response: string, intent: string, agent: string, processingTimeMs: number }
 */
@Controller('api/v1/channels')
export class ChannelsController {
  private readonly logger = new Logger(ChannelsController.name);

  constructor(private readonly routerAgent: RouterAgent) {}

  /**
   * Process an inbound message from any channel via the Router Agent pipeline.
   * Returns the AI-generated response text.
   */
  @Post('inbound')
  @HttpCode(200)
  async inbound(@Body() payload: ChannelInboundPayload) {
    const sessionId = payload.conversationId ?? payload.senderId;
    const from = payload.senderId;
    const text = payload.text?.trim() ?? '';

    if (!text) {
      return { response: '', intent: 'unknown', agent: 'router', processingTimeMs: 0 };
    }

    this.logger.log(
      `Inbound from channel=${payload.channel ?? 'web'} senderId=${from} ` +
        `conversationId=${payload.conversationId ?? 'n/a'} text="${text.slice(0, 80)}"`,
    );

    try {
      const result = await this.routerAgent.process(text, sessionId, from);

      const responseText = result.response.content ?? result.response.text ?? '';
      const intent = result.decision.classification?.intent ?? 'unknown';
      const agent = result.decision.targetAgent ?? 'router';

      this.logger.log(
        `Auto-respond processed: intent=${intent}, agent=${agent}, ` +
          `${result.processingTimeMs}ms`,
      );

      return {
        response: responseText,
        text: responseText,
        intent,
        agent,
        processingTimeMs: result.processingTimeMs,
        done: result.response.done,
      };
    } catch (err: unknown) {
      this.logger.error(
        `Router Agent processing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        response: '',
        text: '',
        intent: 'unknown',
        agent: 'router',
        processingTimeMs: 0,
        error: err instanceof Error ? err.message : 'Router processing failed',
      };
    }
  }
}
