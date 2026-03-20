// LINE Channel Adapter — @unicore/integrations
// Wraps the LINE Messaging API for sending messages, managing rich menus, and validating webhooks.

import { createHmac, timingSafeEqual } from 'node:crypto';

const LINE_API_BASE = 'https://api.line.me/v2/bot';

// ─── Configuration ─────────────────────────────────────────────────────────────

export interface LineAdapterConfig {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
}

// ─── Message types ─────────────────────────────────────────────────────────────

export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LineImageMessage {
  type: 'image';
  originalContentUrl: string;
  previewImageUrl: string;
}

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: unknown;
}

export interface LineStickerMessage {
  type: 'sticker';
  packageId: string;
  stickerId: string;
}

export type LineMessage =
  | LineTextMessage
  | LineImageMessage
  | LineFlexMessage
  | LineStickerMessage;

// ─── Response types ────────────────────────────────────────────────────────────

export interface LineProfile {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
}

export interface LineApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
}

// ─── Adapter ───────────────────────────────────────────────────────────────────

export class LineAdapter {
  readonly #channelSecret: string;
  readonly #channelAccessToken: string;

  constructor(config: LineAdapterConfig) {
    this.#channelSecret = config.channelSecret;
    this.#channelAccessToken = config.channelAccessToken;
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Reply to a webhook event. Must be called within 30 seconds of receiving the event.
   */
  async replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
    await this.#callApi('message/reply', {
      replyToken,
      messages,
    });
  }

  /**
   * Push a message to a user, group, or room.
   */
  async pushMessage(to: string, messages: LineMessage[]): Promise<void> {
    await this.#callApi('message/push', {
      to,
      messages,
    });
  }

  /**
   * Get a user's LINE profile.
   */
  async getProfile(userId: string): Promise<LineProfile> {
    const response = await this.#callApi<LineProfile>(`profile/${userId}`);
    return response.data!;
  }

  /**
   * Validate a webhook request signature using HMAC-SHA256.
   * Returns true if the signature matches the body signed with the channel secret.
   */
  validateSignature(body: string, signature: string): boolean {
    const digest = createHmac('SHA256', this.#channelSecret)
      .update(body)
      .digest('base64');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const sigBuffer = Buffer.from(signature, 'base64');
      const digestBuffer = Buffer.from(digest, 'base64');
      if (sigBuffer.length !== digestBuffer.length) return false;
      return timingSafeEqual(sigBuffer, digestBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Create a rich menu and return the rich menu ID.
   */
  async createRichMenu(menu: unknown): Promise<string> {
    const response = await this.#callApi<{ richMenuId: string }>('richmenu', menu);
    return response.data!.richMenuId;
  }

  /**
   * Delete a rich menu.
   */
  async deleteRichMenu(richMenuId: string): Promise<void> {
    await this.#callApi(`richmenu/${richMenuId}`, undefined, 'DELETE');
  }

  /**
   * Set a rich menu as the default for all users.
   */
  async setDefaultRichMenu(richMenuId: string): Promise<void> {
    await this.#callApi(`user/all/richmenu/${richMenuId}`, undefined, 'POST');
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  async #callApi<T = unknown>(
    path: string,
    body?: unknown,
    method?: string,
  ): Promise<LineApiResponse<T>> {
    const url = `${LINE_API_BASE}/${path}`;

    const resolvedMethod = method ?? (body ? 'POST' : 'GET');

    const init: RequestInit = {
      method: resolvedMethod,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#channelAccessToken}`,
      },
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorBody = await response.text();
      let message: string;
      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.message ?? `HTTP ${response.status}: ${errorBody}`;
      } catch {
        message = `HTTP ${response.status}: ${errorBody}`;
      }
      return { ok: false, message };
    }

    // Some LINE endpoints return 200 with empty body
    const text = await response.text();
    if (!text) {
      return { ok: true };
    }

    const data = JSON.parse(text) as T;
    return { ok: true, data };
  }
}
