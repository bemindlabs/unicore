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
import { Public } from '../auth/decorators/public.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';

/**
 * Minimal Telegram Update shape — only the fields we inspect.
 * Full type: https://core.telegram.org/bots/api#update
 */
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    date: number;
    text?: string;
  };
}

@Controller('webhooks/telegram')
@ProFeatureRequired('allChannels')
@UseGuards(LicenseGuard)
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Receives Telegram Update objects sent by Telegram servers.
   * Validates the secret token header if a webhook secret is configured.
   * Currently logs the message; OpenClaw forwarding is a future step.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): { ok: true } {
    // Validate webhook secret if configured (set via dashboard Settings → Channels)
    const expectedSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretToken !== expectedSecret) {
      this.logger.warn(
        `Telegram webhook received with invalid secret token (update_id=${update.update_id})`,
      );
      throw new ForbiddenException('Invalid webhook secret token');
    }

    // Extract message details
    const message = update.message;
    if (message) {
      const chatId = message.chat.id;
      const senderId = message.from?.id;
      const senderName = message.from
        ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`
        : 'unknown';
      const text = message.text ?? '[non-text message]';

      this.logger.log(
        `Telegram message received: chat=${chatId}, sender=${senderId} (${senderName}), text="${text}"`,
      );
    } else {
      this.logger.log(
        `Telegram update received (no message): update_id=${update.update_id}`,
      );
    }

    // Forward to OpenClaw agent pipeline (fire-and-forget)
    if (message) {
      const openclawHost = this.config.get<string>('OPENCLAW_SERVICE_HOST') ?? 'unicore-openclaw-gateway';
      const openclawPort = this.config.get<string>('OPENCLAW_SERVICE_PORT') ?? '18790';
      const openclawUrl = `http://${openclawHost}:${openclawPort}/api/v1/channels/inbound`;

      const senderId = message.from?.id?.toString() ?? 'unknown';
      const senderName = message.from
        ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`
        : 'unknown';
      const text = message.text ?? '[non-text message]';

      const payload = {
        channel: 'telegram',
        senderId,
        senderName,
        text,
        rawPayload: update,
      };

      fetch(openclawUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err: unknown) => {
        this.logger.error(
          `Failed to forward Telegram message to OpenClaw: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }

    return { ok: true };
  }
}
