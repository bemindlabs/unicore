import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InboundRouterService, NormalizedMessage } from './inbound-router.service';

describe('InboundRouterService', () => {
  let service: InboundRouterService;
  let configGet: jest.Mock;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    configGet = jest.fn((key: string, fallback?: string) => {
      const cfg: Record<string, string> = {
        OPENCLAW_SERVICE_HOST: 'openclaw-test',
        OPENCLAW_SERVICE_PORT: '18790',
      };
      return cfg[key] ?? fallback ?? undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboundRouterService,
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<InboundRouterService>(InboundRouterService);

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('route()', () => {
    it('forwards the message to OpenClaw', async () => {
      const msg: NormalizedMessage = {
        channel: 'telegram',
        senderId: '12345',
        senderName: 'Alice',
        text: 'Hello',
      };

      await service.route(msg);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://openclaw-test:18790/api/v1/channels/inbound',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.channel).toBe('telegram');
      expect(body.senderId).toBe('12345');
      expect(body.text).toBe('Hello');
    });

    it('defaults senderName to senderId when not provided', async () => {
      await service.route({ channel: 'email', senderId: 'user@example.com', text: 'Hi' });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.senderName).toBe('user@example.com');
    });

    it('adds a timestamp when not provided', async () => {
      const before = new Date().toISOString();
      await service.route({ channel: 'webchat', senderId: 'sess-1', text: 'Hey' });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp!).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    });

    it('preserves an existing timestamp', async () => {
      const ts = '2026-01-01T00:00:00.000Z';
      await service.route({ channel: 'slack', senderId: 'U123', text: 'msg', timestamp: ts });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.timestamp).toBe(ts);
    });

    it('does not throw when OpenClaw is unreachable', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.route({ channel: 'line', senderId: 'U999', text: 'oops' }),
      ).resolves.not.toThrow();
    });

    it('uses config values for OpenClaw host and port', async () => {
      configGet.mockImplementation((key: string) => {
        if (key === 'OPENCLAW_SERVICE_HOST') return 'my-openclaw';
        if (key === 'OPENCLAW_SERVICE_PORT') return '9876';
        return undefined;
      });

      await service.route({ channel: 'discord', senderId: 'user-1', text: 'Test' });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://my-openclaw:9876/api/v1/channels/inbound',
        expect.any(Object),
      );
    });

    it('falls back to default OpenClaw host when config returns undefined', async () => {
      configGet.mockReturnValue(undefined);

      await service.route({ channel: 'whatsapp', senderId: '+1234', text: 'Hi' });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://unicore-openclaw-gateway:18790/api/v1/channels/inbound',
        expect.any(Object),
      );
    });

    it('includes rawPayload in the forwarded body', async () => {
      const raw = { event_id: 'abc-123', extra: true };
      await service.route({
        channel: 'telegram',
        senderId: 'U1',
        text: 'with raw',
        rawPayload: raw,
      });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.rawPayload).toEqual(raw);
    });

    it('includes metadata in the forwarded body', async () => {
      const meta = { page: '/checkout', userId: 'guest-42' };
      await service.route({
        channel: 'webchat',
        senderId: 'sess-xyz',
        text: 'help',
        metadata: meta,
      });

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string) as NormalizedMessage;
      expect(body.metadata).toEqual(meta);
    });
  });
});
