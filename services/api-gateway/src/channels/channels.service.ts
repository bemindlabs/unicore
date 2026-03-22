import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ChannelType = 'telegram' | 'line' | 'facebook' | 'instagram' | 'whatsapp' | 'slack' | 'discord' | string;

export interface SendResult {
  success: boolean;
  externalId?: string;
  timestamp: string;
  error?: string;
}

export interface ChannelStatus {
  channelType: ChannelType;
  configured: boolean;
  label: string;
}

/**
 * Lightweight ChannelService — reads channel credentials from the Settings table
 * and dispatches outbound messages without requiring the full @unicore-pro/channels package.
 *
 * Supported channels:
 *   - telegram: calls https://api.telegram.org/bot{token}/sendMessage
 *   - line:     calls https://api.line.me/v2/bot/message/push
 *   - others:   logs a warning (not yet implemented)
 */
@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a text message to any configured channel.
   *
   * @param channelType  e.g. 'telegram', 'line'
   * @param conversationId  The channel-specific chat/room/conversation ID
   * @param text  Message text
   * @param recipientId  Optional — used by some channels instead of conversationId
   */
  async send(
    channelType: ChannelType,
    conversationId: string,
    text: string,
    recipientId?: string,
  ): Promise<SendResult> {
    const settings = await this.loadSettings();

    switch (channelType) {
      case 'telegram':
        return this.sendTelegram(settings, conversationId, text, recipientId);
      case 'line':
        return this.sendLine(settings, conversationId, text, recipientId);
      default:
        this.logger.warn(
          `Channel "${channelType}" is not yet configured in ChannelsService. ` +
            `Skipping send (conversationId=${conversationId}).`,
        );
        return {
          success: false,
          timestamp: new Date().toISOString(),
          error: `Channel "${channelType}" is not supported yet.`,
        };
    }
  }

  /**
   * Returns the configured status for each known channel.
   */
  async getStatus(): Promise<ChannelStatus[]> {
    const settings = await this.loadSettings();
    const channels = settings['channels'] as Record<string, unknown> | undefined ?? {};

    const knownChannels: Array<{ type: ChannelType; label: string; key: string }> = [
      { type: 'telegram', label: 'Telegram', key: 'telegramBotToken' },
      { type: 'line', label: 'LINE', key: 'lineAccessToken' },
      { type: 'facebook', label: 'Facebook Messenger', key: 'facebookAccessToken' },
      { type: 'instagram', label: 'Instagram', key: 'instagramAccessToken' },
      { type: 'whatsapp', label: 'WhatsApp', key: 'whatsappAccessToken' },
      { type: 'slack', label: 'Slack', key: 'slackBotToken' },
      { type: 'discord', label: 'Discord', key: 'discordBotToken' },
    ];

    return knownChannels.map(({ type, label, key }) => ({
      channelType: type,
      label,
      configured: Boolean((channels as Record<string, unknown>)?.[key]),
    }));
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Load the global Settings row (id = "default") from the database.
   * Returns the parsed JSON data object (or empty object on failure).
   */
  private async loadSettings(): Promise<Record<string, unknown>> {
    try {
      const row = await this.prisma.settings.findUnique({ where: { id: 'default' } });
      if (!row) return {};
      return row.data as Record<string, unknown>;
    } catch (err) {
      this.logger.error(`Failed to load Settings from DB: ${(err as Error).message}`);
      return {};
    }
  }

  // ─── Telegram ──────────────────────────────────────────────────────────────

  private async sendTelegram(
    settings: Record<string, unknown>,
    conversationId: string,
    text: string,
    recipientId?: string,
  ): Promise<SendResult> {
    const channels = settings['channels'] as Record<string, unknown> | undefined ?? {};
    const token = (channels['telegramBotToken'] as string | undefined) ?? '';

    if (!token) {
      this.logger.warn('Telegram bot token is not configured in Settings → Channels.');
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: 'Telegram bot token is not configured.',
      };
    }

    const chatId = conversationId || recipientId;
    const apiBase = `https://api.telegram.org/bot${token}`;

    try {
      const res = await fetch(`${apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        const msg = `Telegram API error ${res.status}: ${errText}`;
        this.logger.error(msg);
        return { success: false, timestamp: new Date().toISOString(), error: msg };
      }

      const result = (await res.json()) as { ok: boolean; result?: { message_id: number } };
      const externalId = result.result?.message_id != null ? String(result.result.message_id) : undefined;
      this.logger.log(`Telegram message sent to chat=${chatId}, message_id=${externalId}`);
      return { success: true, externalId, timestamp: new Date().toISOString() };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Telegram send failed: ${msg}`);
      return { success: false, timestamp: new Date().toISOString(), error: msg };
    }
  }

  // ─── LINE ──────────────────────────────────────────────────────────────────

  private async sendLine(
    settings: Record<string, unknown>,
    conversationId: string,
    text: string,
    recipientId?: string,
  ): Promise<SendResult> {
    const channels = settings['channels'] as Record<string, unknown> | undefined ?? {};
    const accessToken = (channels['lineAccessToken'] as string | undefined) ?? '';

    if (!accessToken) {
      this.logger.warn('LINE channel access token is not configured in Settings → Channels.');
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: 'LINE channel access token is not configured.',
      };
    }

    const to = conversationId || recipientId;

    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          to,
          messages: [{ type: 'text', text }],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        const msg = `LINE API error ${res.status}: ${errText}`;
        this.logger.error(msg);
        return { success: false, timestamp: new Date().toISOString(), error: msg };
      }

      this.logger.log(`LINE message sent to userId=${to}`);
      return { success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`LINE send failed: ${msg}`);
      return { success: false, timestamp: new Date().toISOString(), error: msg };
    }
  }
}
