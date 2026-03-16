// Telegram Channel Adapter — @unicore/integrations
// Wraps the Telegram Bot API for sending messages, photos, and managing webhooks.

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramAdapterConfig {
  botToken: string;
  webhookUrl?: string;
}

export interface TelegramSendMessageOptions {
  parseMode?: 'HTML' | 'Markdown';
  replyMarkup?: unknown;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export class TelegramAdapter {
  readonly #botToken: string;
  readonly #webhookUrl?: string;

  constructor(config: TelegramAdapterConfig) {
    this.#botToken = config.botToken;
    this.#webhookUrl = config.webhookUrl;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Send a text message to a chat.
   */
  async sendMessage(
    chatId: string,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResponse> {
    const body: Record<string, unknown> = { chat_id: chatId, text };

    if (options?.parseMode) {
      body.parse_mode = options.parseMode;
    }
    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    return this.#callApi('sendMessage', body);
  }

  /**
   * Send a photo to a chat.
   */
  async sendPhoto(
    chatId: string,
    photo: string,
    caption?: string,
  ): Promise<TelegramApiResponse> {
    const body: Record<string, unknown> = { chat_id: chatId, photo };

    if (caption) {
      body.caption = caption;
    }

    return this.#callApi('sendPhoto', body);
  }

  /**
   * Register a webhook URL with Telegram.
   */
  async setWebhook(url: string, secretToken?: string): Promise<TelegramApiResponse> {
    const body: Record<string, unknown> = { url };

    if (secretToken) {
      body.secret_token = secretToken;
    }

    return this.#callApi('setWebhook', body);
  }

  /**
   * Remove the current webhook.
   */
  async deleteWebhook(): Promise<TelegramApiResponse> {
    return this.#callApi('deleteWebhook', {});
  }

  /**
   * Verify the bot token by fetching bot info.
   */
  async getMe(): Promise<TelegramApiResponse<TelegramUser>> {
    return this.#callApi('getMe');
  }

  /**
   * If a webhook URL was provided in the constructor, register it now.
   * Convenience method for initial setup.
   */
  async setupWebhook(secretToken?: string): Promise<TelegramApiResponse | null> {
    if (!this.#webhookUrl) return null;
    return this.setWebhook(this.#webhookUrl, secretToken);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  async #callApi<T = unknown>(
    method: string,
    body?: Record<string, unknown>,
  ): Promise<TelegramApiResponse<T>> {
    const url = `${TELEGRAM_API_BASE}/bot${this.#botToken}/${method}`;

    const init: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const errorBody = await response.text();
      let parsed: TelegramApiResponse<T>;
      try {
        parsed = JSON.parse(errorBody) as TelegramApiResponse<T>;
      } catch {
        parsed = {
          ok: false,
          description: `HTTP ${response.status}: ${errorBody}`,
          error_code: response.status,
        };
      }
      return parsed;
    }

    return (await response.json()) as TelegramApiResponse<T>;
  }
}
