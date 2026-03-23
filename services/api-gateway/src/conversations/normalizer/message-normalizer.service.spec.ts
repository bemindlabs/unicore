import { Test } from '@nestjs/testing';
import {
  MessageNormalizerService,
  MESSAGE_NORMALIZED_EVENT,
} from './message-normalizer.service';
import {
  NormalizedMessage,
  TelegramRawPayload,
  LINERawPayload,
  WhatsAppRawPayload,
  DiscordRawPayload,
  SlackRawPayload,
  EmailRawPayload,
  WebchatRawPayload,
} from './message-normalizer.types';

// ─── PrismaService stub ──────────────────────────────────────────────────────

const mockPrisma = {
  channelMessage: {
    create: jest.fn().mockResolvedValue({ id: 'db-id' }),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildService(): MessageNormalizerService {
  return new MessageNormalizerService(mockPrisma as never);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MessageNormalizerService', () => {
  let service: MessageNormalizerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MessageNormalizerService,
        { provide: 'PrismaService', useValue: mockPrisma },
      ],
    })
      .overrideProvider(MessageNormalizerService)
      .useFactory({ factory: () => buildService() })
      .compile();

    service = module.get(MessageNormalizerService);
  });

  // ─── normalize() dispatching ──────────────────────────────────────────────

  describe('normalize()', () => {
    it('returns null for an unsupported channel', () => {
      const result = service.normalize('tiktok' as never, {});
      expect(result).toBeNull();
    });

    it('emits MESSAGE_NORMALIZED_EVENT when normalization succeeds', () => {
      const handler = jest.fn();
      service.on(MESSAGE_NORMALIZED_EVENT, handler);

      const payload: WebchatRawPayload = {
        sessionId: 's1',
        messageId: 'm1',
        text: 'hello',
      };
      service.normalize('webchat', payload);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toMatchObject({ channel: 'webchat', text: 'hello' });
    });

    it('does not emit when normalization returns null', () => {
      const handler = jest.fn();
      service.on(MESSAGE_NORMALIZED_EVENT, handler);
      service.normalize('telegram', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── Telegram ─────────────────────────────────────────────────────────────

  describe('Telegram', () => {
    const basePayload: TelegramRawPayload = {
      update_id: 999,
      message: {
        message_id: 42,
        from: { id: 111, is_bot: false, first_name: 'Alice', last_name: 'Smith', username: 'alice' },
        chat: { id: 222, type: 'private', first_name: 'Alice' },
        date: 1700000000,
        text: 'Hello world',
      },
    };

    it('normalizes a text message', () => {
      const result = service.normalize('telegram', basePayload) as NormalizedMessage;
      expect(result).not.toBeNull();
      expect(result.channel).toBe('telegram');
      expect(result.externalId).toBe('42');
      expect(result.conversationId).toBe('222');
      expect(result.senderId).toBe('111');
      expect(result.senderName).toBe('Alice Smith');
      expect(result.text).toBe('Hello world');
      expect(result.contentType).toBe('text');
      expect(result.attachments).toHaveLength(0);
      expect(result.isBot).toBe(false);
      expect(result.timestamp).toEqual(new Date(1700000000 * 1000));
    });

    it('marks bot sender correctly', () => {
      const payload: TelegramRawPayload = {
        ...basePayload,
        message: { ...basePayload.message!, from: { id: 99, is_bot: true, first_name: 'BotName' } },
      };
      const result = service.normalize('telegram', payload) as NormalizedMessage;
      expect(result.isBot).toBe(true);
    });

    it('normalizes a photo message', () => {
      const payload: TelegramRawPayload = {
        update_id: 1,
        message: {
          message_id: 10,
          from: { id: 1, is_bot: false, first_name: 'Bob' },
          chat: { id: 5, type: 'group' },
          date: 1700000000,
          photo: [
            { file_id: 'small', width: 90, height: 90, file_size: 100 },
            { file_id: 'large', width: 800, height: 600, file_size: 50000 },
          ],
        },
      };
      const result = service.normalize('telegram', payload) as NormalizedMessage;
      expect(result.contentType).toBe('image');
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0].url).toBe('large');
      expect(result.attachments[0].width).toBe(800);
    });

    it('normalizes a location message', () => {
      const payload: TelegramRawPayload = {
        update_id: 2,
        message: {
          message_id: 11,
          from: { id: 1, is_bot: false, first_name: 'Carol' },
          chat: { id: 6, type: 'private' },
          date: 1700000001,
          location: { latitude: 13.75, longitude: 100.5 },
        },
      };
      const result = service.normalize('telegram', payload) as NormalizedMessage;
      expect(result.contentType).toBe('location');
      expect(result.attachments[0]).toMatchObject({ type: 'location', lat: 13.75, lng: 100.5 });
    });

    it('captures replyToId', () => {
      const payload: TelegramRawPayload = {
        update_id: 3,
        message: {
          message_id: 12,
          from: { id: 1, is_bot: false, first_name: 'Dan' },
          chat: { id: 7, type: 'supergroup' },
          date: 1700000002,
          text: 'Replied',
          reply_to_message: { message_id: 5 },
        },
      };
      const result = service.normalize('telegram', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('5');
    });

    it('returns null when there is no message in the update', () => {
      const result = service.normalize('telegram', { update_id: 1 });
      expect(result).toBeNull();
    });
  });

  // ─── LINE ─────────────────────────────────────────────────────────────────

  describe('LINE', () => {
    const basePayload: LINERawPayload = {
      destination: 'Uxxxdest',
      events: [
        {
          type: 'message',
          replyToken: 'replyTok123',
          source: { type: 'user', userId: 'Uabc' },
          timestamp: 1700000000000,
          message: { id: 'msg99', type: 'text', text: 'Hi from LINE' },
        },
      ],
    };

    it('normalizes a text message', () => {
      const result = service.normalize('line', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('line');
      expect(result.externalId).toBe('msg99');
      expect(result.conversationId).toBe('Uabc');
      expect(result.senderId).toBe('Uabc');
      expect(result.text).toBe('Hi from LINE');
      expect(result.contentType).toBe('text');
    });

    it('normalizes an image message', () => {
      const payload: LINERawPayload = {
        events: [{
          type: 'message',
          source: { type: 'user', userId: 'Uabc' },
          timestamp: 1700000000000,
          message: { id: 'img1', type: 'image', originalContentUrl: 'https://example.com/img.jpg' },
        }],
      };
      const result = service.normalize('line', payload) as NormalizedMessage;
      expect(result.contentType).toBe('image');
      expect(result.attachments[0].url).toBe('https://example.com/img.jpg');
    });

    it('normalizes a sticker message', () => {
      const payload: LINERawPayload = {
        events: [{
          type: 'message',
          source: { type: 'user', userId: 'Uabc' },
          timestamp: 1700000000000,
          message: { id: 'stk1', type: 'sticker', packageId: 'pkg1', stickerId: 'stk1' },
        }],
      };
      const result = service.normalize('line', payload) as NormalizedMessage;
      expect(result.contentType).toBe('sticker');
      expect(result.text).toBe('[sticker]');
    });

    it('uses groupId as conversationId for group events', () => {
      const payload: LINERawPayload = {
        events: [{
          type: 'message',
          source: { type: 'group', userId: 'Uabc', groupId: 'Ggroup1' },
          timestamp: 1700000000000,
          message: { id: 'm1', type: 'text', text: 'Group msg' },
        }],
      };
      const result = service.normalize('line', payload) as NormalizedMessage;
      expect(result.conversationId).toBe('Ggroup1');
    });

    it('returns null for non-message events', () => {
      const payload: LINERawPayload = {
        events: [{ type: 'follow', source: { type: 'user', userId: 'Uabc' }, timestamp: 1700000000000 }],
      };
      const result = service.normalize('line', payload);
      expect(result).toBeNull();
    });
  });

  // ─── WhatsApp ─────────────────────────────────────────────────────────────

  describe('WhatsApp', () => {
    const basePayload: WhatsAppRawPayload = {
      entry: [{
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+15551234567', phone_number_id: 'phid1' },
            contacts: [{ profile: { name: 'Eve' }, wa_id: '15559876543' }],
            messages: [{
              id: 'wamid.123',
              from: '15559876543',
              timestamp: '1700000000',
              type: 'text',
              text: { body: 'WhatsApp text' },
            }],
          },
        }],
      }],
    };

    it('normalizes a text message', () => {
      const result = service.normalize('whatsapp', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('whatsapp');
      expect(result.externalId).toBe('wamid.123');
      expect(result.senderId).toBe('15559876543');
      expect(result.senderName).toBe('Eve');
      expect(result.text).toBe('WhatsApp text');
      expect(result.contentType).toBe('text');
    });

    it('normalizes an image message with caption', () => {
      const payload: WhatsAppRawPayload = {
        entry: [{
          changes: [{
            value: {
              contacts: [{ wa_id: '123', profile: { name: 'Frank' } }],
              messages: [{
                id: 'wamid.img',
                from: '123',
                timestamp: '1700000000',
                type: 'image',
                image: { id: 'imgid', mime_type: 'image/jpeg', caption: 'Nice pic' },
              }],
            },
          }],
        }],
      };
      const result = service.normalize('whatsapp', payload) as NormalizedMessage;
      expect(result.contentType).toBe('image');
      expect(result.text).toBe('Nice pic');
      expect(result.attachments[0].mimeType).toBe('image/jpeg');
    });

    it('normalizes a location message', () => {
      const payload: WhatsAppRawPayload = {
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{
                id: 'wamid.loc',
                from: '999',
                timestamp: '1700000000',
                type: 'location',
                location: { latitude: 51.5, longitude: -0.1, name: 'London' },
              }],
            },
          }],
        }],
      };
      const result = service.normalize('whatsapp', payload) as NormalizedMessage;
      expect(result.contentType).toBe('location');
      expect(result.attachments[0]).toMatchObject({ lat: 51.5, lng: -0.1 });
    });

    it('preserves reply context', () => {
      const payload: WhatsAppRawPayload = {
        entry: [{
          changes: [{
            value: {
              contacts: [],
              messages: [{
                id: 'wamid.reply',
                from: '111',
                timestamp: '1700000001',
                type: 'text',
                text: { body: 'Replying' },
                context: { id: 'wamid.orig', from: '222' },
              }],
            },
          }],
        }],
      };
      const result = service.normalize('whatsapp', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('wamid.orig');
    });

    it('returns null when there are no messages', () => {
      const result = service.normalize('whatsapp', { entry: [] });
      expect(result).toBeNull();
    });
  });

  // ─── Discord ──────────────────────────────────────────────────────────────

  describe('Discord', () => {
    const basePayload: DiscordRawPayload = {
      id: 'disc123',
      channel_id: 'chan456',
      guild_id: 'guild789',
      author: { id: 'user1', username: 'Grace', discriminator: '0001', avatar: 'avatarhash', bot: false },
      content: 'Discord message',
      timestamp: '2024-01-01T00:00:00.000Z',
      type: 0,
    };

    it('normalizes a text message', () => {
      const result = service.normalize('discord', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('discord');
      expect(result.externalId).toBe('disc123');
      expect(result.conversationId).toBe('chan456');
      expect(result.senderId).toBe('user1');
      expect(result.senderName).toBe('Grace');
      expect(result.text).toBe('Discord message');
      expect(result.contentType).toBe('text');
      expect(result.isBot).toBe(false);
    });

    it('generates avatar URL from hash', () => {
      const result = service.normalize('discord', basePayload) as NormalizedMessage;
      expect(result.senderAvatar).toBe(
        'https://cdn.discordapp.com/avatars/user1/avatarhash.png',
      );
    });

    it('marks bot author', () => {
      const payload = { ...basePayload, author: { ...basePayload.author, bot: true } };
      const result = service.normalize('discord', payload) as NormalizedMessage;
      expect(result.isBot).toBe(true);
    });

    it('normalizes image attachments', () => {
      const payload: DiscordRawPayload = {
        ...basePayload,
        content: '',
        attachments: [{
          id: 'att1',
          filename: 'photo.png',
          size: 12345,
          url: 'https://cdn.discordapp.com/attachments/photo.png',
          content_type: 'image/png',
          width: 1024,
          height: 768,
        }],
      };
      const result = service.normalize('discord', payload) as NormalizedMessage;
      expect(result.contentType).toBe('image');
      expect(result.attachments[0].mimeType).toBe('image/png');
      expect(result.attachments[0].width).toBe(1024);
    });

    it('captures referenced message id', () => {
      const payload: DiscordRawPayload = {
        ...basePayload,
        referenced_message: { id: 'orig999' },
      };
      const result = service.normalize('discord', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('orig999');
    });

    it('returns null when payload is missing author', () => {
      const result = service.normalize('discord', { id: 'x', channel_id: 'y' } as never);
      expect(result).toBeNull();
    });
  });

  // ─── Slack ────────────────────────────────────────────────────────────────

  describe('Slack', () => {
    const basePayload: SlackRawPayload = {
      type: 'event_callback',
      team_id: 'T123',
      event: {
        type: 'message',
        user: 'U456',
        text: 'Slack text',
        channel: 'C789',
        ts: '1700000000.000001',
      },
      event_id: 'Ev001',
      event_time: 1700000000,
    };

    it('normalizes a text message', () => {
      const result = service.normalize('slack', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('slack');
      expect(result.senderId).toBe('U456');
      expect(result.conversationId).toBe('C789');
      expect(result.text).toBe('Slack text');
      expect(result.contentType).toBe('text');
      expect(result.isBot).toBe(false);
    });

    it('detects bot by bot_id field', () => {
      const payload: SlackRawPayload = {
        type: 'event_callback',
        event: { type: 'message', bot_id: 'B001', text: 'I am a bot', channel: 'C1', ts: '1.0' },
      };
      const result = service.normalize('slack', payload) as NormalizedMessage;
      expect(result.isBot).toBe(true);
    });

    it('sets replyToId when ts differs from thread_ts', () => {
      const payload: SlackRawPayload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          text: 'reply',
          channel: 'C1',
          ts: '1700000001.0',
          thread_ts: '1700000000.0',
        },
      };
      const result = service.normalize('slack', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('1700000000.0');
    });

    it('does not set replyToId when ts equals thread_ts (root message)', () => {
      const payload: SlackRawPayload = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U1',
          text: 'root',
          channel: 'C1',
          ts: '1700000000.0',
          thread_ts: '1700000000.0',
        },
      };
      const result = service.normalize('slack', payload) as NormalizedMessage;
      expect(result.replyToId).toBeUndefined();
    });

    it('returns null for url_verification type', () => {
      const result = service.normalize('slack', { type: 'url_verification', challenge: 'abc' });
      expect(result).toBeNull();
    });

    it('returns null for non-message event types', () => {
      const payload: SlackRawPayload = {
        type: 'event_callback',
        event: { type: 'reaction_added', user: 'U1', channel: 'C1' },
      };
      const result = service.normalize('slack', payload);
      expect(result).toBeNull();
    });
  });

  // ─── Email ────────────────────────────────────────────────────────────────

  describe('Email', () => {
    const basePayload: EmailRawPayload = {
      messageId: '<msg001@mail.example.com>',
      from: { address: 'alice@example.com', name: 'Alice' },
      to: [{ address: 'support@unicore.dev' }],
      subject: 'Need help',
      text: 'Please help me with X.',
      date: '2024-01-01T10:00:00.000Z',
    };

    it('normalizes a plain-text email', () => {
      const result = service.normalize('email', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('email');
      expect(result.externalId).toBe('<msg001@mail.example.com>');
      expect(result.senderId).toBe('alice@example.com');
      expect(result.senderName).toBe('Alice');
      expect(result.text).toBe('[Need help] Please help me with X.');
      expect(result.contentType).toBe('text');
    });

    it('strips HTML when only html body is provided', () => {
      const payload: EmailRawPayload = {
        messageId: '<html@mail.example.com>',
        from: { address: 'bob@example.com' },
        html: '<p>Hello <b>world</b></p>',
      };
      const result = service.normalize('email', payload) as NormalizedMessage;
      expect(result.text).toBe('Hello world');
    });

    it('uses address as senderName when name is absent', () => {
      const payload: EmailRawPayload = {
        messageId: '<noname@mail>',
        from: { address: 'noreply@example.com' },
        text: 'hi',
      };
      const result = service.normalize('email', payload) as NormalizedMessage;
      expect(result.senderName).toBe('noreply@example.com');
    });

    it('captures inReplyTo as replyToId', () => {
      const payload: EmailRawPayload = {
        ...basePayload,
        inReplyTo: '<previous@mail.example.com>',
      };
      const result = service.normalize('email', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('<previous@mail.example.com>');
    });

    it('normalizes email with file attachment', () => {
      const payload: EmailRawPayload = {
        ...basePayload,
        attachments: [{ filename: 'doc.pdf', contentType: 'application/pdf', size: 5000 }],
      };
      const result = service.normalize('email', payload) as NormalizedMessage;
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toMatchObject({ type: 'file', fileName: 'doc.pdf', fileSize: 5000 });
    });

    it('returns null when messageId is missing', () => {
      const result = service.normalize('email', { from: { address: 'x@y.com' }, text: 'hi' } as never);
      expect(result).toBeNull();
    });
  });

  // ─── Webchat ──────────────────────────────────────────────────────────────

  describe('Webchat', () => {
    const basePayload: WebchatRawPayload = {
      sessionId: 'session_abc',
      messageId: 'msg_xyz',
      userId: 'visitor_1',
      displayName: 'Website Visitor',
      text: 'I need help',
      timestamp: '2024-01-01T12:00:00.000Z',
      pageUrl: 'https://example.com/pricing',
    };

    it('normalizes a webchat message', () => {
      const result = service.normalize('webchat', basePayload) as NormalizedMessage;
      expect(result.channel).toBe('webchat');
      expect(result.externalId).toBe('msg_xyz');
      expect(result.conversationId).toBe('session_abc');
      expect(result.senderId).toBe('visitor_1');
      expect(result.senderName).toBe('Website Visitor');
      expect(result.text).toBe('I need help');
      expect(result.contentType).toBe('text');
      expect(result.isBot).toBe(false);
      expect(result.metadata['pageUrl']).toBe('https://example.com/pricing');
    });

    it('uses sessionId as senderId when userId is absent', () => {
      const payload: WebchatRawPayload = {
        sessionId: 's1',
        messageId: 'm1',
        text: 'hi',
      };
      const result = service.normalize('webchat', payload) as NormalizedMessage;
      expect(result.senderId).toBe('s1');
      expect(result.senderName).toBe('Visitor');
    });

    it('uses current time when timestamp is absent', () => {
      const before = new Date();
      const payload: WebchatRawPayload = { sessionId: 's2', messageId: 'm2', text: 'hello' };
      const result = service.normalize('webchat', payload) as NormalizedMessage;
      const after = new Date();
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('captures replyToId', () => {
      const payload: WebchatRawPayload = { ...basePayload, replyToId: 'msg_prev' };
      const result = service.normalize('webchat', payload) as NormalizedMessage;
      expect(result.replyToId).toBe('msg_prev');
    });

    it('returns null when sessionId is missing', () => {
      const result = service.normalize('webchat', { messageId: 'm1', text: 'hi' } as never);
      expect(result).toBeNull();
    });
  });

  // ─── persistMessage() ─────────────────────────────────────────────────────

  describe('persistMessage()', () => {
    it('calls prisma.channelMessage.create with correct data', async () => {
      const payload: WebchatRawPayload = { sessionId: 's1', messageId: 'm1', text: 'persist me' };
      const normalized = service.normalize('webchat', payload) as NormalizedMessage;
      await service.persistMessage(normalized);

      expect(mockPrisma.channelMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'webchat',
            externalId: 'm1',
            text: 'persist me',
          }),
        }),
      );
    });

    it('returns null and does not throw on P2002 duplicate error', async () => {
      mockPrisma.channelMessage.create.mockRejectedValueOnce({ code: 'P2002' });
      const payload: WebchatRawPayload = { sessionId: 's1', messageId: 'm1', text: 'dup' };
      const normalized = service.normalize('webchat', payload) as NormalizedMessage;
      const result = await service.persistMessage(normalized);
      expect(result).toBeNull();
    });

    it('returns null and logs on unexpected DB error', async () => {
      mockPrisma.channelMessage.create.mockRejectedValueOnce(new Error('DB down'));
      const payload: WebchatRawPayload = { sessionId: 's1', messageId: 'm1', text: 'err' };
      const normalized = service.normalize('webchat', payload) as NormalizedMessage;
      const result = await service.persistMessage(normalized);
      expect(result).toBeNull();
    });
  });

  // ─── normalizeAndPersist() ────────────────────────────────────────────────

  describe('normalizeAndPersist()', () => {
    it('normalizes, persists, and returns the message', async () => {
      const payload: WebchatRawPayload = { sessionId: 's1', messageId: 'm1', text: 'combined' };
      const result = await service.normalizeAndPersist('webchat', payload);
      expect(result).not.toBeNull();
      expect(mockPrisma.channelMessage.create).toHaveBeenCalledTimes(1);
    });

    it('returns null and does not call create for unrecognised payloads', async () => {
      const result = await service.normalizeAndPersist('telegram', { update_id: 1 });
      expect(result).toBeNull();
      expect(mockPrisma.channelMessage.create).not.toHaveBeenCalled();
    });
  });
});
