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
 * Minimal Facebook Messenger webhook shape.
 * Full type: https://developers.facebook.com/docs/messenger-platform/webhooks
 */
interface FacebookMessagingEntry {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
  };
}

interface FacebookEntry {
  id: string;
  time: number;
  messaging?: FacebookMessagingEntry[];
}

interface FacebookWebhookBody {
  object: string;
  entry: FacebookEntry[];
}

@Controller('webhooks/facebook')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class FacebookWebhookController {
  private readonly logger = new Logger(FacebookWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Facebook webhook verification challenge (GET).
   * Facebook sends hub.mode=subscribe, hub.verify_token, hub.challenge.
   */
  @Public()
  @Get()
  @HttpCode(200)
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.config.get<string>('FACEBOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Facebook webhook verification successful');
      return challenge;
    }

    this.logger.warn('Facebook webhook verification failed: invalid verify token');
    throw new ForbiddenException('Invalid verify token');
  }

  /**
   * Receives Facebook Messenger webhook updates (POST).
   * Validates X-Hub-Signature-256 header using HMAC-SHA256 with app secret.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() body: FacebookWebhookBody,
    @Headers('x-hub-signature-256') signature?: string,
  ): { ok: true } {
    const appSecret = this.config.get<string>('FACEBOOK_APP_SECRET');
    if (appSecret) {
      if (!signature) {
        this.logger.warn('Facebook webhook received without X-Hub-Signature-256 header');
        throw new ForbiddenException('Missing webhook signature');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, appSecret)) {
        this.logger.warn('Facebook webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const messaging = body.entry?.[0]?.messaging?.[0];
    if (messaging) {
      const senderId = messaging.sender?.id ?? 'unknown';
      const text = messaging.message?.text ?? '[non-text message]';

      this.logger.log(
        `Facebook message received: channel=facebook, sender=${senderId}, text="${text}"`,
      );

      // Fire-and-forget forward to OpenClaw
      const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
      const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
      fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'facebook', sender: senderId, text, raw: body }),
      }).catch((err: unknown) => {
        this.logger.warn(`Failed to forward Facebook message to OpenClaw: ${String(err)}`);
      });
    } else {
      this.logger.log('Facebook webhook received (no messaging entry)');
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
