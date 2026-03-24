// ─── Supported Channels ────────────────────────────────────────────────────

export type NormalizedChannel =
  | 'telegram'
  | 'line'
  | 'whatsapp'
  | 'discord'
  | 'slack'
  | 'email'
  | 'webchat';

// ─── Content Types ──────────────────────────────────────────────────────────

export type MessageContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'sticker'
  | 'location'
  | 'unknown';

// ─── Attachment ─────────────────────────────────────────────────────────────

export interface MessageAttachment {
  type: MessageContentType;
  url?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  /** Duration in seconds for audio/video */
  duration?: number;
  width?: number;
  height?: number;
  caption?: string;
  /** Latitude for location messages */
  lat?: number;
  /** Longitude for location messages */
  lng?: number;
}

// ─── Unified Normalized Message ──────────────────────────────────────────────

export interface NormalizedMessage {
  /** Generated UUID for this normalized record */
  id: string;
  /** Source channel */
  channel: NormalizedChannel;
  /** Message ID as provided by the source channel */
  externalId: string;
  /** Chat / room / conversation ID in the source channel */
  conversationId: string;
  /** Sender's identifier in the source channel */
  senderId: string;
  /** Sender's display name */
  senderName: string;
  /** Sender's avatar URL, if provided by the channel */
  senderAvatar?: string;
  /** Primary text content (empty string if non-text) */
  text: string;
  /** Dominant content type of this message */
  contentType: MessageContentType;
  /** Media / file attachments, if any */
  attachments: MessageAttachment[];
  /** External message ID being replied to, if applicable */
  replyToId?: string;
  /** Whether the sender is a bot / automated system */
  isBot: boolean;
  /** When the message was originally sent in the source channel */
  timestamp: Date;
  /** Channel-specific extras (e.g. thread_ts for Slack, subject for email) */
  metadata: Record<string, unknown>;
  /** The original, unmodified payload from the channel */
  rawPayload: unknown;
}

// ─── Raw Channel Payload Types ───────────────────────────────────────────────

/** Telegram Update — minimal subset we inspect */
export interface TelegramRawPayload {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
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
    reply_to_message?: { message_id: number };
    photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
    video?: { file_id: string; width: number; height: number; duration: number; file_size?: number };
    audio?: { file_id: string; duration: number; file_size?: number; mime_type?: string };
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
    voice?: { file_id: string; duration: number; file_size?: number };
    sticker?: { file_id: string; width: number; height: number };
    location?: { latitude: number; longitude: number };
  };
}

/** LINE Webhook Event — minimal subset */
export interface LINERawPayload {
  destination?: string;
  events: Array<{
    type: string;
    replyToken?: string;
    source: {
      type: string;
      userId?: string;
      groupId?: string;
      roomId?: string;
    };
    timestamp: number;
    message?: {
      id: string;
      type: string;
      text?: string;
      originalContentUrl?: string;
      previewImageUrl?: string;
      duration?: number;
      fileName?: string;
      fileSize?: number;
      latitude?: number;
      longitude?: number;
      address?: string;
      packageId?: string;
      stickerId?: string;
    };
    replyTo?: { messageId: string };
  }>;
}

/** WhatsApp Cloud API message — minimal subset */
export interface WhatsAppRawPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          image?: { id?: string; mime_type?: string; sha256?: string; caption?: string };
          video?: { id?: string; mime_type?: string; sha256?: string };
          audio?: { id?: string; mime_type?: string; voice?: boolean };
          document?: { id?: string; mime_type?: string; filename?: string; sha256?: string; caption?: string };
          sticker?: { id?: string; mime_type?: string; animated?: boolean };
          location?: { latitude?: number; longitude?: number; name?: string; address?: string };
          context?: { id?: string; from?: string };
        }>;
      };
    }>;
  }>;
}

/** Discord Message Object — minimal subset */
export interface DiscordRawPayload {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: {
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
    bot?: boolean;
  };
  content: string;
  timestamp: string;
  type: number;
  referenced_message?: { id: string };
  attachments?: Array<{
    id: string;
    filename: string;
    size: number;
    url: string;
    proxy_url?: string;
    content_type?: string;
    width?: number;
    height?: number;
  }>;
}

/** Slack Events API — minimal subset */
export interface SlackRawPayload {
  type: string;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    parent_user_id?: string;
    bot_id?: string;
    files?: Array<{
      id: string;
      name?: string;
      mimetype?: string;
      size?: number;
      url_private?: string;
      thumb_360?: string;
    }>;
    [key: string]: unknown;
  };
  event_id?: string;
  event_time?: number;
}

/** Inbound email — normalised from any SMTP/IMAP bridge */
export interface EmailRawPayload {
  messageId: string;
  from: { address: string; name?: string };
  to?: Array<{ address: string; name?: string }>;
  cc?: Array<{ address: string; name?: string }>;
  subject?: string;
  text?: string;
  html?: string;
  date?: string;
  inReplyTo?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
    content?: string;
  }>;
}

/** Webchat (widget) message */
export interface WebchatRawPayload {
  sessionId: string;
  messageId: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
  text: string;
  timestamp?: string;
  replyToId?: string;
  pageUrl?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}
