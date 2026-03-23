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
import { InboundRouterService } from './inbound-router.service';

/**
 * Minimal inbound email shape — supports both SendGrid Inbound Parse
 * (lowercase fields) and Postmark (PascalCase fields).
 *
 * SendGrid docs: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
 * Postmark docs: https://postmarkapp.com/developer/webhooks/inbound-webhook
 */
interface EmailWebhookBody {
  // SendGrid / common lowercase fields
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  // Postmark PascalCase fields
  From?: string;
  To?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  [key: string]: unknown;
}

@Controller('webhooks/email')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class EmailWebhookController {
  private readonly logger = new Logger(EmailWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly inboundRouter: InboundRouterService,
  ) {}

  /**
   * Receives inbound email events from SendGrid Inbound Parse or Postmark.
   *
   * Signature verification:
   *   - If EMAIL_WEBHOOK_SECRET is set, validates X-Email-Webhook-Signature (HMAC-SHA256)
   *   - Falls back to checking X-Webhook-Secret header for simple token auth
   *
   * @Public — no JWT required; email providers do not authenticate via JWT
   */
  @Public()
  @Post()
  @HttpCode(200)
  async handleEmail(
    @Body() body: EmailWebhookBody,
    @Headers('x-email-webhook-signature') signature?: string,
    @Headers('x-webhook-secret') secret?: string,
  ): Promise<{ ok: true }> {
    const expectedSecret = this.config.get<string>('EMAIL_WEBHOOK_SECRET');
    if (expectedSecret) {
      if (signature) {
        const bodyString = JSON.stringify(body);
        if (!this.#validateHmac(bodyString, signature, expectedSecret)) {
          this.logger.warn('Email webhook received with invalid HMAC signature');
          throw new ForbiddenException('Invalid webhook signature');
        }
      } else if (secret !== expectedSecret) {
        this.logger.warn('Email webhook received without valid secret');
        throw new ForbiddenException('Missing or invalid webhook secret');
      }
    }

    // Normalize: support both SendGrid (lowercase) and Postmark (PascalCase)
    const from = body.from ?? body.From ?? 'unknown@unknown.com';
    const subject = body.subject ?? body.Subject ?? '(no subject)';
    const textBody = body.text ?? body.TextBody ?? (body.html ?? body.HtmlBody ? '[HTML email]' : '(empty)');
    const senderId = this.#extractEmail(from);
    const senderName = this.#extractName(from);

    this.logger.log(`Email webhook received: from=${from}, subject="${subject}"`);

    await this.inboundRouter.route({
      channel: 'email',
      senderId,
      senderName,
      text: `[Email] Subject: ${subject}\n${textBody}`,
      rawPayload: body as Record<string, unknown>,
    });

    return { ok: true };
  }

  /** Validates HMAC-SHA256 signature using timing-safe comparison. */
  #validateHmac(body: string, signature: string, secret: string): boolean {
    const digest = createHmac('sha256', secret).update(body).digest('hex');
    try {
      const sigBuffer = Buffer.from(signature);
      const digestBuffer = Buffer.from(digest);
      if (sigBuffer.length !== digestBuffer.length) return false;
      return timingSafeEqual(sigBuffer, digestBuffer);
    } catch {
      return false;
    }
  }

  /** Extracts bare email address from "Name <email@example.com>" or "email@example.com". */
  #extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1].trim() : from.trim();
  }

  /** Extracts display name from "Name <email@example.com>", falls back to bare address. */
  #extractName(from: string): string {
    const match = from.match(/^([^<]+)<[^>]+>/);
    return match ? match[1].trim() : this.#extractEmail(from);
  }
}
