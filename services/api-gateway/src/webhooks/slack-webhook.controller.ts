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
 * Minimal Slack Events API payload shape.
 * Full type: https://api.slack.com/apis/connections/events-api
 */
interface SlackUrlVerificationBody {
  type: 'url_verification';
  challenge: string;
  token?: string;
}

interface SlackEventBody {
  type: 'event_callback';
  team_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    [key: string]: unknown;
  };
  event_id?: string;
  event_time?: number;
}

type SlackWebhookBody = SlackUrlVerificationBody | SlackEventBody;

@Controller('webhooks/slack')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class SlackWebhookController {
  private readonly logger = new Logger(SlackWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Handles Slack Events API payloads (POST).
   * - url_verification: return challenge immediately (before signature check per Slack docs)
   * - event_callback: validate X-Slack-Signature, then process event
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleEvent(
    @Body() body: SlackWebhookBody,
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
  ): { challenge?: string; ok?: true } {
    // URL verification does not require signature check
    if (body.type === 'url_verification') {
      this.logger.log('Slack url_verification challenge received');
      return { challenge: (body as SlackUrlVerificationBody).challenge };
    }

    // Validate signing secret for all other events
    const signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET');
    if (signingSecret) {
      if (!signature || !timestamp) {
        this.logger.warn(
          'Slack webhook received without X-Slack-Signature or X-Slack-Request-Timestamp header',
        );
        throw new ForbiddenException('Missing webhook signature headers');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, timestamp, signingSecret)) {
        this.logger.warn('Slack webhook received with invalid signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    if (body.type === 'event_callback') {
      const eventBody = body as SlackEventBody;
      const event = eventBody.event;
      const senderId = event?.user ?? 'unknown';
      const text = event?.text ?? `[${event?.type ?? 'unknown'} event]`;

      this.logger.log(
        `Slack event received: channel=slack, type=${event?.type ?? 'unknown'}, sender=${senderId}, text="${text}"`,
      );

      // Fire-and-forget forward to OpenClaw
      const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
      const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
      fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'slack', sender: senderId, text, raw: body }),
      }).catch((err: unknown) => {
        this.logger.warn(`Failed to forward Slack event to OpenClaw: ${String(err)}`);
      });
    } else {
      this.logger.log(`Slack webhook received: type=${(body as Record<string, unknown>).type}`);
    }

    return { ok: true };
  }

  /**
   * Validate X-Slack-Signature using HMAC-SHA256 with signing secret.
   * Slack signature format: "v0=<hex_digest>"
   * Base string: "v0:<timestamp>:<body>"
   */
  #validateSignature(
    body: string,
    signature: string,
    timestamp: string,
    secret: string,
  ): boolean {
    // Prevent replay attacks: reject requests older than 5 minutes
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
      this.logger.warn('Slack webhook timestamp too old (possible replay attack)');
      return false;
    }

    const baseString = `v0:${timestamp}:${body}`;
    const digest = 'v0=' + createHmac('sha256', secret).update(baseString).digest('hex');

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
