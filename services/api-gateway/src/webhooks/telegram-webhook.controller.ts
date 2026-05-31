import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { LicenseGuard } from '../license/guards/license.guard';
import { ProFeatureRequired } from '../license/decorators/pro-feature.decorator';
import { WebhookTenantResolver } from './webhook-tenant-resolver.service';

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

  constructor(
    private readonly config: ConfigService,
    private readonly tenantResolver: WebhookTenantResolver,
  ) {}

  /**
   * Legacy path-less Telegram webhook.
   *
   * GAPS #1 (residual fix): a Telegram Update carries NO bot identifier, so a
   * path-less webhook cannot be attributed to a tenant. Previously this fell back
   * to the DEMO tenant — a silent cross-tenant leak. We now REJECT it with
   * 410 Gone and instruct the caller to register the per-bot webhook URL
   * `/webhooks/telegram/<botId>` (where `<botId>` is the integer prefix of the
   * bot token), which is unambiguously resolvable. We never silently use DEMO.
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') _secretToken?: string,
  ): never {
    this.logger.warn(
      `Rejected path-less Telegram webhook (update_id=${update?.update_id ?? 'n/a'}): ` +
        'cannot resolve owning tenant. Register the per-bot URL /webhooks/telegram/<botId>.',
    );
    throw new HttpException(
      'Path-less Telegram webhook is not supported: it cannot be attributed to a tenant. ' +
        'Register your bot webhook as /webhooks/telegram/<botId> (the integer prefix of the bot token).',
      HttpStatus.GONE,
    );
  }

  /** Per-bot webhook path — enables tenant resolution by bot id. */
  @Public()
  @Post(':botId')
  @HttpCode(200)
  handleUpdateForBot(
    @Param('botId') botId: string,
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: true }> {
    return this.process(update, botId, secretToken);
  }

  private async process(
    update: TelegramUpdate,
    botId: string,
    secretToken?: string,
  ): Promise<{ ok: true }> {
    // Validate webhook secret if configured (set via dashboard Settings → Channels)
    const expectedSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (expectedSecret && secretToken !== expectedSecret) {
      this.logger.warn(
        `Telegram webhook received with invalid secret token (update_id=${update.update_id})`,
      );
      throw new ForbiddenException('Invalid webhook secret token');
    }

    // GAPS #1: resolve the owning tenant from the per-bot webhook path's botId.
    // If no tenant claims this bot id we REJECT rather than silently using DEMO.
    const resolvedTenantId = await this.tenantResolver.resolveTelegram(botId);
    if (!resolvedTenantId) {
      this.logger.warn(
        `No tenant owns Telegram botId=${botId} (update_id=${update.update_id}); rejecting.`,
      );
      throw new HttpException(
        `No tenant is configured for Telegram bot "${botId}". ` +
          'Configure the bot token under Settings → Channels for the owning tenant.',
        HttpStatus.NOT_FOUND,
      );
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
        tenantId: resolvedTenantId,
        senderId,
        senderName,
        text,
        rawPayload: update,
      };

      fetch(openclawUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': resolvedTenantId,
        },
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
