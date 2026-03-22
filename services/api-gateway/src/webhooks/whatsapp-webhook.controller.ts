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
 * Minimal WhatsApp Cloud API webhook shape.
 * Full type: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppChangeValue {
  messaging_product: string;
  metadata?: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: WhatsAppMessage[];
}

interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

interface WhatsAppWebhookBody {
  object: string;
  entry: WhatsAppEntry[];
}

@Controller('webhooks/whatsapp')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * WhatsApp webhook verification challenge (GET).
   * Meta platform sends hub.mode=subscribe, hub.verify_token, hub.challenge.
   */
  @Public()
  @Get()
  @HttpCode(200)
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expectedToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('WhatsApp webhook verification successful');
      return challenge;
    }

    this.logger.warn('WhatsApp webhook verification failed: invalid verify token');
    throw new ForbiddenException('Invalid verify token');
  }

  /**
   * Receives WhatsApp Cloud API webhook updates (POST).
   * Validates X-Hub-Signature-256 header using HMAC-SHA256 with app secret.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() body: WhatsAppWebhookBody,
    @Headers('x-hub-signature-256') signature?: string,
  ): { ok: true } {
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (appSecret) {
      if (!signature) {
        this.logger.warn('WhatsApp webhook received without X-Hub-Signature-256 header');
        throw new ForbiddenException('Missing webhook signature');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, appSecret)) {
        this.logger.warn('WhatsApp webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const senderId = message.from ?? 'unknown';
      const text = message.text?.body ?? `[${message.type} message]`;

      this.logger.log(
        `WhatsApp message received: channel=whatsapp, sender=${senderId}, text="${text}"`,
      );

      // Fire-and-forget forward to OpenClaw
      const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
      const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
      fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'whatsapp', sender: senderId, text, raw: body }),
      }).catch((err: unknown) => {
        this.logger.warn(`Failed to forward WhatsApp message to OpenClaw: ${String(err)}`);
      });
    } else {
      this.logger.log('WhatsApp webhook received (no message entry)');
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
