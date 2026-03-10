// Tests: EmailAdapter

import { EmailAdapter } from '../src/adapters/email/EmailAdapter.js';
import type { IEmailTransport } from '../src/adapters/email/EmailAdapter.js';
import type { EmailConfig, EmailMessage, EmailSendResult } from '../src/types/email.js';

// ─── Mock transport ───────────────────────────────────────────────────────────

function buildMockTransport(overrides: Partial<IEmailTransport> = {}): IEmailTransport {
  return {
    verify: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue({
      messageId: 'msg_001',
      provider: 'smtp',
      accepted: ['user@example.com'],
      rejected: [],
      sentAt: new Date().toISOString(),
    } satisfies EmailSendResult),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const smtpConfig: EmailConfig = {
  provider: 'smtp',
  host: 'smtp.example.com',
  port: 587,
  secure: false,
  auth: { user: 'user@example.com', pass: 'secret' },
  fromAddress: 'noreply@example.com',
  fromName: 'UniCore',
};

const sendgridConfig: EmailConfig = {
  provider: 'sendgrid',
  apiKey: 'SG.test_xxx',
  fromAddress: 'noreply@example.com',
};

const mailgunConfig: EmailConfig = {
  provider: 'mailgun',
  apiKey: 'key-xxx',
  domain: 'mg.example.com',
  fromAddress: 'noreply@example.com',
};

const validMessage: EmailMessage = {
  to: { address: 'user@example.com', name: 'Test User' },
  subject: 'Hello',
  text: 'World',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmailAdapter', () => {
  describe('meta', () => {
    it('has correct metadata', () => {
      const adapter = new EmailAdapter();
      expect(adapter.meta.id).toBe('email');
      expect(adapter.meta.category).toBe('email');
    });
  });

  describe('connect()', () => {
    it.each([
      ['smtp', smtpConfig],
      ['sendgrid', sendgridConfig],
      ['mailgun', mailgunConfig],
    ] as Array<[string, EmailConfig]>)('connects successfully with %s config', async (_, config) => {
      const transport = buildMockTransport();
      const adapter = new EmailAdapter(() => transport);

      const result = await adapter.connect(config);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('connected');
      expect(transport.verify).toHaveBeenCalledTimes(1);
    });

    it('returns INVALID_CONFIG when smtp host is missing', async () => {
      const adapter = new EmailAdapter();
      const result = await adapter.connect({
        provider: 'smtp',
        host: '',
        port: 587,
        secure: false,
        auth: { user: 'u', pass: 'p' },
        fromAddress: 'a@b.com',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONFIG');
    });

    it('returns INVALID_CONFIG when sendgrid apiKey is missing', async () => {
      const adapter = new EmailAdapter();
      const result = await adapter.connect({ provider: 'sendgrid', apiKey: '', fromAddress: 'a@b.com' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONFIG');
    });

    it('returns EMAIL_CONNECT_FAILED when verify throws', async () => {
      const transport = buildMockTransport({
        verify: jest.fn().mockRejectedValue(new Error('Auth failed')),
      });
      const adapter = new EmailAdapter(() => transport);
      const result = await adapter.connect(smtpConfig);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_CONNECT_FAILED');
    });
  });

  describe('disconnect()', () => {
    it('calls transport.close() and resets state', async () => {
      const transport = buildMockTransport();
      const adapter = new EmailAdapter(() => transport);
      await adapter.connect(smtpConfig);

      const result = await adapter.disconnect();
      expect(result.success).toBe(true);
      expect(transport.close).toHaveBeenCalled();

      const health = await adapter.getStatus();
      expect(health.status).toBe('disconnected');
    });
  });

  describe('sync()', () => {
    it('returns an outbound sync result with zero records', async () => {
      const adapter = new EmailAdapter(() => buildMockTransport());
      await adapter.connect(smtpConfig);
      const result = await adapter.sync();

      expect(result.success).toBe(true);
      expect(result.data?.direction).toBe('outbound');
      expect(result.data?.recordsFetched).toBe(0);
    });

    it('returns NOT_CONNECTED when not connected', async () => {
      const adapter = new EmailAdapter();
      const result = await adapter.sync();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_CONNECTED');
    });
  });

  describe('send()', () => {
    it('sends a valid message and returns a result', async () => {
      const transport = buildMockTransport();
      const adapter = new EmailAdapter(() => transport);
      await adapter.connect(smtpConfig);

      const result = await adapter.send(validMessage);

      expect(result.success).toBe(true);
      expect(result.data?.messageId).toBe('msg_001');
      expect(transport.send).toHaveBeenCalledWith(validMessage);
    });

    it('returns INVALID_MESSAGE when subject is missing', async () => {
      const adapter = new EmailAdapter(() => buildMockTransport());
      await adapter.connect(smtpConfig);
      const result = await adapter.send({ to: { address: 'a@b.com' }, subject: '', text: 'hi' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_MESSAGE');
    });

    it('returns INVALID_MESSAGE when no body', async () => {
      const adapter = new EmailAdapter(() => buildMockTransport());
      await adapter.connect(smtpConfig);
      const result = await adapter.send({ to: { address: 'a@b.com' }, subject: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_MESSAGE');
    });

    it('returns INVALID_RECIPIENTS for bad email address', async () => {
      const adapter = new EmailAdapter(() => buildMockTransport());
      await adapter.connect(smtpConfig);
      const result = await adapter.send({
        to: { address: 'not-valid' },
        subject: 'Test',
        text: 'body',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RECIPIENTS');
    });

    it('returns NOT_CONNECTED when not connected', async () => {
      const adapter = new EmailAdapter();
      const result = await adapter.send(validMessage);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_CONNECTED');
    });
  });

  describe('sendBatch()', () => {
    it('sends multiple messages and returns sent/failed breakdown', async () => {
      const transport = buildMockTransport();
      const adapter = new EmailAdapter(() => transport);
      await adapter.connect(smtpConfig);

      const messages: EmailMessage[] = [
        { to: { address: 'a@example.com' }, subject: 'A', text: 'body' },
        { to: { address: 'b@example.com' }, subject: 'B', text: 'body' },
      ];

      const { sent, failed } = await adapter.sendBatch(messages);

      expect(sent).toHaveLength(2);
      expect(failed).toHaveLength(0);
    });

    it('collects failures for invalid messages', async () => {
      const transport = buildMockTransport();
      const adapter = new EmailAdapter(() => transport);
      await adapter.connect(smtpConfig);

      const messages: EmailMessage[] = [
        { to: { address: 'good@example.com' }, subject: 'Good', text: 'ok' },
        { to: { address: 'not-valid' }, subject: 'Bad', text: 'ok' },
      ];

      const { sent, failed } = await adapter.sendBatch(messages);

      expect(sent).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0]!.error.code).toBe('INVALID_RECIPIENTS');
    });
  });
});
