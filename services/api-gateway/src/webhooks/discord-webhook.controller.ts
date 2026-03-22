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
import { createVerify } from 'node:crypto';
import { Public } from '../auth/decorators/public.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

/**
 * Discord Interaction types (subset).
 * Full type: https://discord.com/developers/docs/interactions/receiving-and-responding
 */
const DISCORD_INTERACTION_TYPE_PING = 1;
const DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND = 2;
const DISCORD_INTERACTION_TYPE_MESSAGE_COMPONENT = 3;

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
}

interface DiscordMessage {
  id: string;
  content?: string;
  author?: DiscordUser;
}

interface DiscordInteractionBody {
  type: number;
  id?: string;
  application_id?: string;
  token?: string;
  user?: DiscordUser;
  member?: { user?: DiscordUser };
  data?: {
    name?: string;
    content?: string;
    [key: string]: unknown;
  };
  message?: DiscordMessage;
  [key: string]: unknown;
}

@Controller('webhooks/discord')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class DiscordWebhookController {
  private readonly logger = new Logger(DiscordWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Handles Discord interactions webhook (POST).
   * - type 1 (PING): must return { type: 1 } immediately after signature check
   * - type 2/3 (APPLICATION_COMMAND / MESSAGE_COMPONENT): process and forward
   * Discord requires Ed25519 signature validation on every request.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleInteraction(
    @Body() body: DiscordInteractionBody,
    @Headers('x-signature-ed25519') signature?: string,
    @Headers('x-signature-timestamp') timestamp?: string,
  ): { type: number } | { ok: true } {
    const publicKey = this.config.get<string>('DISCORD_PUBLIC_KEY');
    if (publicKey) {
      if (!signature || !timestamp) {
        this.logger.warn(
          'Discord webhook received without X-Signature-Ed25519 or X-Signature-Timestamp header',
        );
        throw new ForbiddenException('Missing webhook signature headers');
      }

      const bodyString = JSON.stringify(body);
      if (!this.#validateSignature(bodyString, signature, timestamp, publicKey)) {
        this.logger.warn('Discord webhook received with invalid Ed25519 signature');
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    // PING — Discord health check, must respond with type 1
    if (body.type === DISCORD_INTERACTION_TYPE_PING) {
      this.logger.log('Discord PING received, responding with PONG (type 1)');
      return { type: 1 };
    }

    // Extract sender and message text
    const sender =
      body.user?.id ?? body.member?.user?.id ?? 'unknown';
    const senderName =
      body.user?.username ?? body.member?.user?.username ?? 'unknown';
    const text =
      body.message?.content ??
      body.data?.content ??
      `[interaction type=${body.type}]`;

    const interactionLabel =
      body.type === DISCORD_INTERACTION_TYPE_APPLICATION_COMMAND
        ? 'APPLICATION_COMMAND'
        : body.type === DISCORD_INTERACTION_TYPE_MESSAGE_COMPONENT
          ? 'MESSAGE_COMPONENT'
          : `type=${body.type}`;

    this.logger.log(
      `Discord interaction received: channel=discord, type=${interactionLabel}, sender=${sender} (${senderName}), text="${text}"`,
    );

    // Fire-and-forget forward to OpenClaw
    const host = this.config.get<string>('OPENCLAW_SERVICE_HOST', 'openclaw-gateway');
    const port = this.config.get<string>('OPENCLAW_SERVICE_PORT', '18790');
    fetch(`http://${host}:${port}/api/v1/channels/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'discord', sender, text, raw: body }),
    }).catch((err: unknown) => {
      this.logger.warn(`Failed to forward Discord interaction to OpenClaw: ${String(err)}`);
    });

    return { ok: true };
  }

  /**
   * Validate Ed25519 signature from Discord.
   * The signed message is: timestamp + raw body string.
   */
  #validateSignature(
    body: string,
    signature: string,
    timestamp: string,
    publicKey: string,
  ): boolean {
    try {
      const verifier = createVerify('ed25519');
      verifier.update(timestamp + body);
      return verifier.verify(
        Buffer.from(publicKey, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
