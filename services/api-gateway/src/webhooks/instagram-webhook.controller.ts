import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  Logger,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

/**
 * Minimal Instagram webhook shape (Meta platform — same structure as Facebook).
 * Full type: https://developers.facebook.com/docs/instagram-platform/webhooks
 */
interface InstagramMessagingEntry {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
  };
}

interface InstagramEntry {
  id: string;
  time: number;
  messaging?: InstagramMessagingEntry[];
}

interface InstagramWebhookBody {
  object: string;
  entry: InstagramEntry[];
}

@Controller('webhooks/instagram')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class InstagramWebhookController {
  private readonly logger = new Logger(InstagramWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Instagram webhook verification challenge (GET).
   * Same Meta platform pattern as Facebook.
   */
  @Public()
  @Get()
  @HttpCode(200)
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.config.get<string>('INSTAGRAM_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Instagram webhook verification successful');
      return challenge;
    }

    this.logger.warn('Instagram webhook verification failed: invalid verify token');
    throw new ForbiddenException('Invalid verify token');
  }

  /**
   * Receives Instagram webhook updates (POST).
   * Validates X-Hub-Signature-256 header using HMAC-SHA256 with app secret.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() body: InstagramWebhookBody,
    @Headers('x-hub-signature-256') signature?: string,
  ): { ok: true } {
    const appSecret = this.config.get<string>('INSTAGRAM_APP_SECRET');
    if (appSecret) {
      if (!signature) {
        this.logger.warn('Instagram webhook received without X-Hub-Signature-256 header');
        throw new ForbiddenException('Missing webhook signature');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, appSecret)) {
        this.logger.warn('Instagram webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const messaging = body.entry?.[0]?.messaging?.[0];
    if (messaging) {
      const senderId = messaging.sender?.id ?? 'unknown';
      const text = messaging.message?.text ?? '[non-text message]';

      this.logger.log(
        `Instagram message received: channel=instagram, sender=${senderId}, text="${text}"`,
      );

      // Fire-and-forget forward to OpenClaw
      const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
      const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
      fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'instagram', sender: senderId, text, raw: body }),
      }).catch((err: unknown) => {
        this.logger.warn(`Failed to forward Instagram message to OpenClaw: ${String(err)}`);
      });
    } else {
      this.logger.log('Instagram webhook received (no messaging entry)');
    }

    return { ok: true };
  }

  /**
   * Validate X-Hub-Signature-256 header using HMAC-SHA256.
   * Header format: "sha256=<hex_digest>"
   */
  #validateSignature(body: string, signature: string, secret: string): boolean {
    const digest = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

    try {
      const sigBuffer = Buffer.from(signature);
      const digestBuffer = Buffer.from(digest);
      if (sigBuffer.length !== digestBuffer.length) return false;
      return timingSafeEqual(sigBuffer, digestBuffer);
    } catch {
      return false;
    }
  }
}
