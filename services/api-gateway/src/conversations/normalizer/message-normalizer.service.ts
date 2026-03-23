import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NormalizedChannel,
  NormalizedMessage,
  MessageContentType,
  MessageAttachment,
  TelegramRawPayload,
  LINERawPayload,
  WhatsAppRawPayload,
  DiscordRawPayload,
  SlackRawPayload,
  EmailRawPayload,
  WebchatRawPayload,
} from './message-normalizer.types';

/** Event emitted after a message is successfully normalized (and optionally persisted). */
export const MESSAGE_NORMALIZED_EVENT = 'message.normalized';

@Injectable()
export class MessageNormalizerService extends EventEmitter {
  private readonly logger = new Logger(MessageNormalizerService.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Normalize a raw inbound payload from any supported channel into a
   * unified {@link NormalizedMessage}.
   *
   * Emits a {@link MESSAGE_NORMALIZED_EVENT} after normalization so that
   * real-time subscribers (e.g. the OpenClaw WebSocket pipeline) can react
   * without coupling directly to this service.
   *
   * @param channel  Source channel identifier
   * @param raw      Raw payload as received from the channel webhook
   * @returns        Unified normalized message, or `null` if the payload
   *                 does not contain a recognisable user message
   */
  normalize(channel: NormalizedChannel, raw: unknown): NormalizedMessage | null {
    let normalized: NormalizedMessage | null;

    switch (channel) {
      case 'telegram':
        normalized = this.normalizeTelegram(raw as TelegramRawPayload);
        break;
      case 'line':
        normalized = this.normalizeLINE(raw as LINERawPayload);
        break;
      case 'whatsapp':
        normalized = this.normalizeWhatsApp(raw as WhatsAppRawPayload);
        break;
      case 'discord':
        normalized = this.normalizeDiscord(raw as DiscordRawPayload);
        break;
      case 'slack':
        normalized = this.normalizeSlack(raw as SlackRawPayload);
        break;
      case 'email':
        normalized = this.normalizeEmail(raw as EmailRawPayload);
        break;
      case 'webchat':
        normalized = this.normalizeWebchat(raw as WebchatRawPayload);
        break;
      default:
        this.logger.warn(`normalize(): unsupported channel "${String(channel)}"`);
        normalized = null;
    }

    if (normalized) {
      this.emit(MESSAGE_NORMALIZED_EVENT, normalized);
    }

    return normalized;
  }

  /**
   * Persist a {@link NormalizedMessage} to the `channel_messages` table.
   * Silently skips on duplicate `(channel, externalId)` pairs.
   *
   * @returns The saved DB record, or `null` on unique-constraint skip / error.
   */
  async persistMessage(message: NormalizedMessage) {
    try {
      return await this.prisma.channelMessage.create({
        data: {
          id: message.id,
          channel: message.channel,
          externalId: message.externalId,
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar ?? null,
          text: message.text,
          contentType: message.contentType,
          attachments: message.attachments as object[],
          replyToId: message.replyToId ?? null,
          isBot: message.isBot,
          timestamp: message.timestamp,
          metadata: message.metadata as unknown as import('../../generated/prisma').Prisma.InputJsonValue,
          rawPayload: message.rawPayload as unknown as import('../../generated/prisma').Prisma.InputJsonValue,
        },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        // Unique constraint — already persisted, not an error
        this.logger.debug(
          `Duplicate channel message skipped: channel=${message.channel} externalId=${message.externalId}`,
        );
        return null;
      }
      this.logger.error(
        `Failed to persist channel message: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Convenience method: normalize + persist in one call.
   * Returns the normalized message (or `null` if the raw payload was not a
   * recognisable user message).
   */
  async normalizeAndPersist(
    channel: NormalizedChannel,
    raw: unknown,
  ): Promise<NormalizedMessage | null> {
    const normalized = this.normalize(channel, raw);
    if (normalized) {
      await this.persistMessage(normalized);
    }
    return normalized;
  }

  // ─── Telegram ──────────────────────────────────────────────────────────────

  private normalizeTelegram(raw: TelegramRawPayload): NormalizedMessage | null {
    const msg = raw?.message;
    if (!msg) return null;

    const senderId = String(msg.from?.id ?? 'unknown');
    const senderName = msg.from
      ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
      : 'Unknown';
    const conversationId = String(msg.chat.id);
    const externalId = String(msg.message_id);
    const timestamp = new Date(msg.date * 1000);

    let text = msg.text ?? '';
    let contentType: MessageContentType = msg.text ? 'text' : 'unknown';
    const attachments: MessageAttachment[] = [];

    if (msg.photo?.length) {
      const largest = msg.photo[msg.photo.length - 1];
      contentType = 'image';
      attachments.push({
        type: 'image',
        url: largest.file_id,
        width: largest.width,
        height: largest.height,
        fileSize: largest.file_size,
      });
    } else if (msg.video) {
      contentType = 'video';
      attachments.push({
        type: 'video',
        url: msg.video.file_id,
        width: msg.video.width,
        height: msg.video.height,
        duration: msg.video.duration,
        fileSize: msg.video.file_size,
      });
    } else if (msg.audio) {
      contentType = 'audio';
      attachments.push({
        type: 'audio',
        url: msg.audio.file_id,
        duration: msg.audio.duration,
        mimeType: msg.audio.mime_type,
        fileSize: msg.audio.file_size,
      });
    } else if (msg.voice) {
      contentType = 'audio';
      attachments.push({ type: 'audio', url: msg.voice.file_id, duration: msg.voice.duration });
    } else if (msg.document) {
      contentType = 'file';
      attachments.push({
        type: 'file',
        url: msg.document.file_id,
        fileName: msg.document.file_name,
        mimeType: msg.document.mime_type,
        fileSize: msg.document.file_size,
      });
    } else if (msg.sticker) {
      contentType = 'sticker';
      text = text || '[sticker]';
      attachments.push({ type: 'sticker', url: msg.sticker.file_id, width: msg.sticker.width, height: msg.sticker.height });
    } else if (msg.location) {
      contentType = 'location';
      text = text || '[location]';
      attachments.push({ type: 'location', lat: msg.location.latitude, lng: msg.location.longitude });
    }

    return {
      id: randomUUID(),
      channel: 'telegram',
      externalId,
      conversationId,
      senderId,
      senderName,
      text,
      contentType,
      attachments,
      replyToId: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
      isBot: msg.from?.is_bot ?? false,
      timestamp,
      metadata: {
        updateId: raw.update_id,
        chatType: msg.chat.type,
        username: msg.from?.username,
      },
      rawPayload: raw,
    };
  }

  // ─── LINE ──────────────────────────────────────────────────────────────────

  private normalizeLINE(raw: LINERawPayload): NormalizedMessage | null {
    const event = raw?.events?.[0];
    if (!event || event.type !== 'message' || !event.message) return null;

    const m = event.message;
    const source = event.source;
    const senderId = source.userId ?? 'unknown';
    const conversationId = source.groupId ?? source.roomId ?? source.userId ?? 'unknown';
    const timestamp = new Date(event.timestamp);

    let text = '';
    let contentType: MessageContentType = 'unknown';
    const attachments: MessageAttachment[] = [];

    switch (m.type) {
      case 'text':
        text = m.text ?? '';
        contentType = 'text';
        break;
      case 'image':
        contentType = 'image';
        attachments.push({ type: 'image', url: m.originalContentUrl });
        break;
      case 'video':
        contentType = 'video';
        attachments.push({ type: 'video', url: m.originalContentUrl, duration: m.duration });
        break;
      case 'audio':
        contentType = 'audio';
        attachments.push({ type: 'audio', url: m.originalContentUrl, duration: m.duration });
        break;
      case 'file':
        contentType = 'file';
        attachments.push({ type: 'file', fileName: m.fileName, fileSize: m.fileSize });
        break;
      case 'sticker':
        contentType = 'sticker';
        text = '[sticker]';
        attachments.push({ type: 'sticker', url: `${m.packageId}/${m.stickerId}` });
        break;
      case 'location':
        contentType = 'location';
        text = m.address ?? '[location]';
        attachments.push({ type: 'location', lat: m.latitude, lng: m.longitude, caption: m.address });
        break;
      default:
        contentType = 'unknown';
    }

    return {
      id: randomUUID(),
      channel: 'line',
      externalId: m.id,
      conversationId,
      senderId,
      senderName: senderId, // LINE webhooks don't include display name
      text,
      contentType,
      attachments,
      replyToId: event.replyTo?.messageId,
      isBot: false,
      timestamp,
      metadata: {
        replyToken: event.replyToken,
        sourceType: source.type,
        destination: raw.destination,
      },
      rawPayload: raw,
    };
  }

  // ─── WhatsApp ──────────────────────────────────────────────────────────────

  private normalizeWhatsApp(raw: WhatsAppRawPayload): NormalizedMessage | null {
    const value = raw?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const contacts = value?.contacts ?? [];
    const contact = contacts.find((c) => c.wa_id === message.from);
    const senderName = contact?.profile?.name ?? message.from;
    const conversationId = String(value?.metadata?.phone_number_id ?? message.from);
    const timestamp = new Date(parseInt(message.timestamp, 10) * 1000);

    let text = '';
    let contentType: MessageContentType = 'unknown';
    const attachments: MessageAttachment[] = [];

    switch (message.type) {
      case 'text':
        text = message.text?.body ?? '';
        contentType = 'text';
        break;
      case 'image':
        contentType = 'image';
        text = message.image?.caption ?? '';
        attachments.push({ type: 'image', url: message.image?.id, mimeType: message.image?.mime_type, caption: message.image?.caption });
        break;
      case 'video':
        contentType = 'video';
        attachments.push({ type: 'video', url: message.video?.id, mimeType: message.video?.mime_type });
        break;
      case 'audio':
        contentType = 'audio';
        attachments.push({ type: 'audio', url: message.audio?.id, mimeType: message.audio?.mime_type });
        break;
      case 'document':
        contentType = 'file';
        text = message.document?.caption ?? '';
        attachments.push({ type: 'file', url: message.document?.id, fileName: message.document?.filename, mimeType: message.document?.mime_type });
        break;
      case 'sticker':
        contentType = 'sticker';
        text = '[sticker]';
        attachments.push({ type: 'sticker', url: message.sticker?.id, mimeType: message.sticker?.mime_type });
        break;
      case 'location':
        contentType = 'location';
        text = message.location?.name ?? '[location]';
        attachments.push({ type: 'location', lat: message.location?.latitude, lng: message.location?.longitude, caption: message.location?.name });
        break;
      default:
        contentType = 'unknown';
        text = `[${message.type}]`;
    }

    return {
      id: randomUUID(),
      channel: 'whatsapp',
      externalId: message.id,
      conversationId,
      senderId: message.from,
      senderName,
      text,
      contentType,
      attachments,
      replyToId: message.context?.id,
      isBot: false,
      timestamp,
      metadata: {
        phoneNumberId: value?.metadata?.phone_number_id,
        displayPhoneNumber: value?.metadata?.display_phone_number,
      },
      rawPayload: raw,
    };
  }

  // ─── Discord ───────────────────────────────────────────────────────────────

  private normalizeDiscord(raw: DiscordRawPayload): NormalizedMessage | null {
    if (!raw?.id || !raw.author) return null;

    const attachments: MessageAttachment[] = (raw.attachments ?? []).map((a) => {
      const type: MessageContentType = this.#mimeToContentType(a.content_type ?? '');
      return {
        type,
        url: a.url,
        fileName: a.filename,
        fileSize: a.size,
        mimeType: a.content_type,
        width: a.width,
        height: a.height,
      };
    });

    const contentType: MessageContentType =
      attachments.length > 0 ? attachments[0].type : raw.content ? 'text' : 'unknown';

    const avatarUrl = raw.author.avatar
      ? `https://cdn.discordapp.com/avatars/${raw.author.id}/${raw.author.avatar}.png`
      : undefined;

    return {
      id: randomUUID(),
      channel: 'discord',
      externalId: raw.id,
      conversationId: raw.channel_id,
      senderId: raw.author.id,
      senderName: raw.author.username,
      senderAvatar: avatarUrl,
      text: raw.content ?? '',
      contentType,
      attachments,
      replyToId: raw.referenced_message?.id,
      isBot: raw.author.bot ?? false,
      timestamp: new Date(raw.timestamp),
      metadata: {
        guildId: raw.guild_id,
        messageType: raw.type,
      },
      rawPayload: raw,
    };
  }

  // ─── Slack ─────────────────────────────────────────────────────────────────

  private normalizeSlack(raw: SlackRawPayload): NormalizedMessage | null {
    if (raw.type !== 'event_callback' || !raw.event) return null;

    const ev = raw.event;
    if (ev.type !== 'message' && ev.type !== 'app_mention') return null;

    const senderId = ev.user ?? ev.bot_id ?? 'unknown';
    const conversationId = ev.channel ?? 'unknown';
    const externalId = ev.ts ?? String(raw.event_time ?? Date.now());
    const timestamp = ev.ts ? new Date(parseFloat(ev.ts) * 1000) : new Date();

    const files = ev.files ?? [];
    const attachments: MessageAttachment[] = (files as Array<{ id: string; name?: string; mimetype?: string; size?: number; url_private?: string; thumb_360?: string }>).map((f) => ({
      type: this.#mimeToContentType(f.mimetype ?? ''),
      url: f.url_private,
      fileName: f.name,
      mimeType: f.mimetype,
      fileSize: f.size,
    }));

    return {
      id: randomUUID(),
      channel: 'slack',
      externalId,
      conversationId,
      senderId,
      senderName: senderId, // Display name requires Slack users.info API call
      text: ev.text ?? '',
      contentType: attachments.length > 0 ? attachments[0].type : ev.text ? 'text' : 'unknown',
      attachments,
      replyToId: ev.thread_ts && ev.thread_ts !== ev.ts ? ev.thread_ts : undefined,
      isBot: Boolean(ev.bot_id),
      timestamp,
      metadata: {
        teamId: raw.team_id,
        threadTs: ev.thread_ts,
        eventId: raw.event_id,
      },
      rawPayload: raw,
    };
  }

  // ─── Email ─────────────────────────────────────────────────────────────────

  private normalizeEmail(raw: EmailRawPayload): NormalizedMessage | null {
    if (!raw?.messageId || !raw.from?.address) return null;

    const attachments: MessageAttachment[] = (raw.attachments ?? []).map((a) => ({
      type: this.#mimeToContentType(a.contentType ?? ''),
      fileName: a.filename,
      mimeType: a.contentType,
      fileSize: a.size,
    }));

    const text = raw.text ?? this.#stripHtml(raw.html ?? '');
    const subject = raw.subject ?? '';

    return {
      id: randomUUID(),
      channel: 'email',
      externalId: raw.messageId,
      conversationId: raw.from.address,
      senderId: raw.from.address,
      senderName: raw.from.name ?? raw.from.address,
      text: subject ? `[${subject}] ${text}` : text,
      contentType: attachments.length > 0 ? attachments[0].type : 'text',
      attachments,
      replyToId: raw.inReplyTo,
      isBot: false,
      timestamp: raw.date ? new Date(raw.date) : new Date(),
      metadata: {
        subject,
        to: raw.to?.map((t) => t.address),
        cc: raw.cc?.map((c) => c.address),
      },
      rawPayload: raw,
    };
  }

  // ─── Webchat ───────────────────────────────────────────────────────────────

  private normalizeWebchat(raw: WebchatRawPayload): NormalizedMessage | null {
    if (!raw?.sessionId || !raw.messageId) return null;

    return {
      id: randomUUID(),
      channel: 'webchat',
      externalId: raw.messageId,
      conversationId: raw.sessionId,
      senderId: raw.userId ?? raw.sessionId,
      senderName: raw.displayName ?? 'Visitor',
      senderAvatar: raw.avatarUrl,
      text: raw.text ?? '',
      contentType: 'text',
      attachments: [],
      replyToId: raw.replyToId,
      isBot: false,
      timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
      metadata: {
        pageUrl: raw.pageUrl,
        userAgent: raw.userAgent,
        ...(raw.metadata ?? {}),
      },
      rawPayload: raw,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Map a MIME type to our {@link MessageContentType} enum. */
  #mimeToContentType(mimeType: string): MessageContentType {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  /** Strip HTML tags to extract plain text (best-effort). */
  #stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
