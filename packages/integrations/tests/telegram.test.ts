// Tests: TelegramAdapter

import { TelegramAdapter } from '../src/channels/telegram.js';
import type { TelegramAdapterConfig } from '../src/channels/telegram.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchSuccess(body: unknown): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response);
}

function mockFetchErrorJson(body: unknown, status = 400): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response);
}

function mockFetchErrorText(text: string, status = 500): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
    text: jest.fn().mockResolvedValue(text),
  } as unknown as Response);
}

const validConfig: TelegramAdapterConfig = {
  botToken: 'bot123:test_token',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TelegramAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMe()', () => {
    it('returns bot user info on success', async () => {
      const mockUser = { id: 123, is_bot: true, first_name: 'TestBot', username: 'testbot' };
      const spy = mockFetchSuccess({ ok: true, result: mockUser });
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.getMe();

      expect(result.ok).toBe(true);
      expect(result.result).toEqual(mockUser);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/botbot123:test_token/getMe'),
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('returns error response when API returns HTTP error with JSON', async () => {
      mockFetchErrorJson({ ok: false, description: 'Unauthorized', error_code: 401 }, 401);
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.getMe();

      expect(result.ok).toBe(false);
      expect(result.description).toBe('Unauthorized');
      expect(result.error_code).toBe(401);
    });

    it('returns error response when HTTP error body is not JSON', async () => {
      mockFetchErrorText('Internal Server Error', 500);
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.getMe();

      expect(result.ok).toBe(false);
      expect(result.description).toContain('500');
      expect(result.error_code).toBe(500);
    });
  });

  describe('sendMessage()', () => {
    it('sends a basic text message', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 1 } });
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.sendMessage('chat_123', 'Hello World');

      expect(result.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"text":"Hello World"'),
        }),
      );
    });

    it('includes parse_mode when option is provided', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 2 } });
      const adapter = new TelegramAdapter(validConfig);

      await adapter.sendMessage('chat_123', '<b>Bold</b>', { parseMode: 'HTML' });

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: expect.stringContaining('"parse_mode":"HTML"') }),
      );
    });

    it('includes reply_markup when option is provided', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 3 } });
      const adapter = new TelegramAdapter(validConfig);
      const replyMarkup = { inline_keyboard: [[{ text: 'Click', callback_data: 'click' }]] };

      await adapter.sendMessage('chat_123', 'Choose:', { replyMarkup });

      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ body: expect.stringContaining('"reply_markup"') }),
      );
    });

    it('does not include optional fields when options are absent', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 4 } });
      const adapter = new TelegramAdapter(validConfig);

      await adapter.sendMessage('chat_123', 'Plain message');

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body).not.toHaveProperty('parse_mode');
      expect(body).not.toHaveProperty('reply_markup');
    });
  });

  describe('sendPhoto()', () => {
    it('sends a photo with caption', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 5 } });
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.sendPhoto('chat_123', 'https://example.com/photo.jpg', 'My caption');

      expect(result.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/sendPhoto'),
        expect.objectContaining({ body: expect.stringContaining('"caption":"My caption"') }),
      );
    });

    it('sends a photo without caption', async () => {
      const spy = mockFetchSuccess({ ok: true, result: { message_id: 6 } });
      const adapter = new TelegramAdapter(validConfig);

      await adapter.sendPhoto('chat_123', 'https://example.com/photo.jpg');

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body).not.toHaveProperty('caption');
    });
  });

  describe('setWebhook()', () => {
    it('sets a webhook URL', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.setWebhook('https://example.com/webhook');

      expect(result.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/setWebhook'),
        expect.objectContaining({ body: expect.stringContaining('"url":"https://example.com/webhook"') }),
      );
    });

    it('includes secret_token when provided', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter(validConfig);

      await adapter.setWebhook('https://example.com/webhook', 'my-secret');

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.secret_token).toBe('my-secret');
    });

    it('does not include secret_token when absent', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter(validConfig);

      await adapter.setWebhook('https://example.com/webhook');

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body).not.toHaveProperty('secret_token');
    });
  });

  describe('deleteWebhook()', () => {
    it('deletes the webhook', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter(validConfig);

      const result = await adapter.deleteWebhook();

      expect(result.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/deleteWebhook'),
        expect.anything(),
      );
    });
  });

  describe('setupWebhook()', () => {
    it('returns null when no webhookUrl is configured', async () => {
      const adapter = new TelegramAdapter({ botToken: 'bot123:test_token' });

      const result = await adapter.setupWebhook();

      expect(result).toBeNull();
    });

    it('registers the configured webhookUrl', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter({
        botToken: 'bot123:test_token',
        webhookUrl: 'https://example.com/tg-webhook',
      });

      const result = await adapter.setupWebhook();

      expect(result).not.toBeNull();
      expect(result!.ok).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/setWebhook'),
        expect.objectContaining({ body: expect.stringContaining('example.com/tg-webhook') }),
      );
    });

    it('passes secretToken through to setWebhook', async () => {
      const spy = mockFetchSuccess({ ok: true, result: true });
      const adapter = new TelegramAdapter({
        botToken: 'bot123:test_token',
        webhookUrl: 'https://example.com/tg-webhook',
      });

      await adapter.setupWebhook('my-secret-token');

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.secret_token).toBe('my-secret-token');
    });
  });
});
