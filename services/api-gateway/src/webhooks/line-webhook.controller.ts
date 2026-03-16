import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
  ForbiddenException,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Minimal LINE webhook event shape.
 * Full type: https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
 */
interface LineWebhookEvent {
  type: string;
  timestamp: number;
  replyToken?: string;
  source?: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  message?: {
    id: string;
    type: string;
    text?: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

@Controller('webhooks/line')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);

  /**
   * Receives LINE webhook events.
   * Validates X-Line-Signature header using HMAC-SHA256 of request body with channel secret.
   * LINE requires a 200 response within 1 second.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleWebhook(
    @Body() body: LineWebhookBody,
    @Headers('x-line-signature') signature?: string,
  ): { ok: true } {
    // Validate signature
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (channelSecret) {
      if (!signature) {
        this.logger.warn('LINE webhook received without X-Line-Signature header');
        throw new ForbiddenException('Missing webhook signature');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, channelSecret)) {
        this.logger.warn('LINE webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    // Process events
    const events = body.events ?? [];

    if (events.length === 0) {
      // LINE sends an empty events array for webhook URL verification
      this.logger.log('LINE webhook verification (empty events)');
      return { ok: true };
    }

    for (const event of events) {
      const userId = event.source?.userId ?? 'unknown';
      const eventType = event.type;

      if (eventType === 'message' && event.message) {
        const messageType = event.message.type;
        const text = event.message.text ?? `[${messageType} message]`;
        const replyToken = event.replyToken ?? 'none';

        this.logger.log(
          `LINE message received: userId=${userId}, type=${messageType}, text="${text}", replyToken=${replyToken}`,
        );
      } else {
        this.logger.log(
          `LINE event received: type=${eventType}, userId=${userId}`,
        );
      }

      // TODO: Forward to OpenClaw agent pipeline
    }

    return { ok: true };
  }

  /**
   * Validate webhook signature using HMAC-SHA256.
   */
  #validateSignature(body: string, signature: string, secret: string): boolean {
    const digest = createHmac('SHA256', secret)
      .update(body)
      .digest('base64');

    try {
      const sigBuffer = Buffer.from(signature, 'base64');
      const digestBuffer = Buffer.from(digest, 'base64');
      if (sigBuffer.length !== digestBuffer.length) return false;
      return timingSafeEqual(sigBuffer, digestBuffer);
    } catch {
      return false;
    }
  }
}
