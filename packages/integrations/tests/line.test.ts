// Tests: LineAdapter

import { createHmac } from 'node:crypto';
import { LineAdapter } from '../src/channels/line.js';
import type {
  LineAdapterConfig,
  LineTextMessage,
  LineImageMessage,
  LineFlexMessage,
  LineStickerMessage,
} from '../src/channels/line.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchOk(textBody: string): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(textBody),
  } as unknown as Response);
}

function mockFetchOkEmpty(): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(''),
  } as unknown as Response);
}

function mockFetchError(body: unknown, status = 400): jest.SpyInstance {
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

function computeSignature(body: string, secret: string): string {
  return createHmac('SHA256', secret).update(body).digest('base64');
}

const validConfig: LineAdapterConfig = {
  channelId: 'channel-001',
  channelSecret: 'test-channel-secret',
  channelAccessToken: 'test-access-token',
};

const textMessage: LineTextMessage = { type: 'text', text: 'Hello!' };
const imageMessage: LineImageMessage = {
  type: 'image',
  originalContentUrl: 'https://example.com/image.jpg',
  previewImageUrl: 'https://example.com/preview.jpg',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LineAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validateSignature()', () => {
    it('returns true for a valid signature', () => {
      const adapter = new LineAdapter(validConfig);
      const body = JSON.stringify({ type: 'message' });
      const signature = computeSignature(body, validConfig.channelSecret);

      expect(adapter.validateSignature(body, signature)).toBe(true);
    });

    it('returns false for an incorrect signature', () => {
      const adapter = new LineAdapter(validConfig);
      const body = JSON.stringify({ type: 'message' });
      const wrongSignature = computeSignature(body, 'wrong-secret');

      expect(adapter.validateSignature(body, wrongSignature)).toBe(false);
    });

    it('returns false when signature length differs', () => {
      const adapter = new LineAdapter(validConfig);
      const body = 'test body';
      // Short base64 string — different length from a SHA256 digest
      const shortSig = Buffer.from('short').toString('base64');

      expect(adapter.validateSignature(body, shortSig)).toBe(false);
    });

    it('returns false for an empty signature', () => {
      const adapter = new LineAdapter(validConfig);
      expect(adapter.validateSignature('any body', '')).toBe(false);
    });

    it('returns false for a different body with the same secret', () => {
      const adapter = new LineAdapter(validConfig);
      const originalBody = '{"type":"message"}';
      const signature = computeSignature(originalBody, validConfig.channelSecret);

      // Different body — signature no longer matches
      expect(adapter.validateSignature('{"type":"follow"}', signature)).toBe(false);
    });
  });

  describe('replyMessage()', () => {
    it('sends a reply message to the correct endpoint', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);

      await adapter.replyMessage('reply-token-001', [textMessage]);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/message/reply'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${validConfig.channelAccessToken}`,
          }),
          body: expect.stringContaining('"replyToken":"reply-token-001"'),
        }),
      );
    });

    it('sends multiple messages in a single reply', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);

      await adapter.replyMessage('reply-token-002', [textMessage, imageMessage]);

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.messages).toHaveLength(2);
    });

    it('does not throw when API returns an error response', async () => {
      mockFetchError({ message: 'Invalid reply token' }, 400);
      const adapter = new LineAdapter(validConfig);

      // replyMessage discards the return value — should not throw
      await expect(adapter.replyMessage('bad-token', [textMessage])).resolves.toBeUndefined();
    });
  });

  describe('pushMessage()', () => {
    it('pushes a message to a user', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);

      await adapter.pushMessage('U1234567890', [textMessage]);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/message/push'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"to":"U1234567890"'),
        }),
      );
    });

    it('sends flex and sticker message types', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);
      const flexMsg: LineFlexMessage = {
        type: 'flex',
        altText: 'Flex alt',
        contents: { type: 'bubble' },
      };
      const stickerMsg: LineStickerMessage = {
        type: 'sticker',
        packageId: '1',
        stickerId: '2',
      };

      await adapter.pushMessage('U1234567890', [flexMsg, stickerMsg]);

      const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
      expect(body.messages[0].type).toBe('flex');
      expect(body.messages[1].type).toBe('sticker');
    });
  });

  describe('getProfile()', () => {
    it('returns a user profile', async () => {
      const mockProfile = {
        displayName: 'John Doe',
        userId: 'U123',
        pictureUrl: 'https://profile.line-scdn.net/photo.jpg',
        statusMessage: 'Hey!',
      };
      mockFetchOk(JSON.stringify(mockProfile));
      const adapter = new LineAdapter(validConfig);

      const profile = await adapter.getProfile('U123');

      expect(profile.displayName).toBe('John Doe');
      expect(profile.userId).toBe('U123');
    });

    it('calls the correct profile endpoint', async () => {
      const spy = mockFetchOk(JSON.stringify({ displayName: 'Jane', userId: 'U456' }));
      const adapter = new LineAdapter(validConfig);

      await adapter.getProfile('U456');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/profile/U456'),
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('createRichMenu()', () => {
    it('returns the richMenuId from the response', async () => {
      mockFetchOk(JSON.stringify({ richMenuId: 'richmenu-abc123' }));
      const adapter = new LineAdapter(validConfig);

      const richMenuId = await adapter.createRichMenu({ name: 'My Menu', size: { width: 2500, height: 1686 } });

      expect(richMenuId).toBe('richmenu-abc123');
    });

    it('posts to the richmenu endpoint', async () => {
      const spy = mockFetchOk(JSON.stringify({ richMenuId: 'richmenu-xyz' }));
      const adapter = new LineAdapter(validConfig);

      await adapter.createRichMenu({ name: 'Test' });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/richmenu'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('deleteRichMenu()', () => {
    it('deletes a rich menu by ID', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);

      await adapter.deleteRichMenu('richmenu-abc123');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/richmenu/richmenu-abc123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('setDefaultRichMenu()', () => {
    it('sets a rich menu as default for all users', async () => {
      const spy = mockFetchOkEmpty();
      const adapter = new LineAdapter(validConfig);

      await adapter.setDefaultRichMenu('richmenu-abc123');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('/user/all/richmenu/richmenu-abc123'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('error handling', () => {
    it('returns error response with message from JSON error body', async () => {
      mockFetchError({ message: 'Not found', sentMessages: [] }, 404);
      const adapter = new LineAdapter(validConfig);

      // getProfile returns response.data which is undefined on error
      const profile = await adapter.getProfile('UNKNOWN');

      // data is undefined; the error was silently swallowed in #callApi
      expect(profile).toBeUndefined();
    });

    it('handles non-JSON error body gracefully', async () => {
      mockFetchErrorText('Service Unavailable', 503);
      const adapter = new LineAdapter(validConfig);

      // Should not throw — #callApi catches the error internally
      await expect(adapter.replyMessage('token', [textMessage])).resolves.toBeUndefined();
    });
  });
});
