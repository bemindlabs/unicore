import {
  Controller,
  Post,
  Body,
  Headers,
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
 * Minimal TikTok webhook event shape.
 * Full type: https://developers.tiktok.com/doc/webhooks-overview
 */
interface TikTokWebhookBody {
  type?: string;
  event?: string;
  data?: {
    user_id?: string;
    message?: string;
    content?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Controller('webhooks/tiktok')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class TikTokWebhookController {
  private readonly logger = new Logger(TikTokWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Receives TikTok webhook events (POST only).
   * Validates X-TikTok-Signature header using HMAC-SHA256 with client secret.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleEvent(
    @Body() body: TikTokWebhookBody,
    @Headers('x-tiktok-signature') signature?: string,
  ): { ok: true } {
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET');
    if (clientSecret) {
      if (!signature) {
        this.logger.warn('TikTok webhook received without X-TikTok-Signature header');
        throw new ForbiddenException('Missing webhook signature');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, clientSecret)) {
        this.logger.warn('TikTok webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const eventType = body.type ?? body.event ?? 'unknown';
    const senderId = body.data?.user_id ?? 'unknown';
    const text =
      body.data?.message ?? body.data?.content ?? `[${eventType} event]`;

    this.logger.log(
      `TikTok event received: channel=tiktok, type=${eventType}, sender=${senderId}, text="${text}"`,
    );

    // Fire-and-forget forward to OpenClaw
    const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
    const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
    fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'tiktok', sender: senderId, text, raw: body }),
    }).catch((err: unknown) => {
      this.logger.warn(`Failed to forward TikTok event to OpenClaw: ${String(err)}`);
    });

    return { ok: true };
  }

  /**
   * Validate TikTok webhook signature using HMAC-SHA256.
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
