import {
  Controller,
  Post,
  Body,
  Param,
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
   * Receives Telegram Update objects sent by Telegram servers.
   *
   * GAPS #1: a Telegram Update carries NO bot identifier, so multi-tenant
   * disambiguation relies on a per-tenant webhook path — register each tenant's
   * bot webhook as `/webhooks/telegram/<botId>`. The `:botId` is matched against
   * the tenant's stored bot token to resolve the owning tenant. The legacy
   * path-less route (`/webhooks/telegram`) cannot disambiguate and falls back to
   * the DEMO tenant (see residual gap note in the PR/report).
   */
  @Public()
  @Post()
  @HttpCode(200)
  handleUpdate(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ): Promise<{ ok: true }> {
    return this.process(update, undefined, secretToken);
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
    botId: string | undefined,
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
    const resolvedTenantId =
      (await this.tenantResolver.resolveTelegram(botId)) ??
      this.tenantResolver.fallbackTenantId;

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
