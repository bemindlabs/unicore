// Email Adapter — @unicore/integrations
// Sends transactional email via SMTP, SendGrid, or Mailgun.

import type { IAdapter, AdapterMeta, AdapterHealth, AdapterResult, AdapterError, SyncOptions, SyncResult } from '../../types/adapter.js';
import type {
  EmailConfig,
  EmailAddress,
  EmailMessage,
  EmailSendResult,
  EmailProvider,
  SmtpConfig,
  SendGridConfig,
  MailgunConfig,
} from '../../types/email.js';
import { ok, okVoid, err, tryCatch, toAdapterError } from '../../utils/result.js';
import { validateRequiredFields, isValidEmail } from '../../utils/validation.js';

const META: AdapterMeta = {
  id: 'email',
  name: 'Email',
  description: 'Send transactional email via SMTP, SendGrid, or Mailgun.',
  version: '0.1.0',
  category: 'email',
};

// ─── Provider transport contract (injectable for testing) ─────────────────────

export interface IEmailTransport {
  verify(): Promise<void>;
  send(message: EmailMessage): Promise<EmailSendResult>;
  close(): Promise<void>;
}

// ─── Email Adapter ────────────────────────────────────────────────────────────

export class EmailAdapter implements IAdapter<EmailConfig, EmailSendResult> {
  readonly meta: AdapterMeta = META;

  #transport: IEmailTransport | null = null;
  #lastCheckedAt = new Date().toISOString();

  constructor(private readonly transportFactory?: (config: EmailConfig) => IEmailTransport) {}

  // ─── connect ──────────────────────────────────────────────────────────────

  async connect(config: EmailConfig): Promise<AdapterResult<AdapterHealth>> {
    const configError = this.#validateConfig(config);
    if (configError) return err<AdapterHealth>(configError);

    return tryCatch(async () => {
      const transport = this.#buildTransport(config);
      const start = Date.now();
      await transport.verify();
      const latencyMs = Date.now() - start;

      this.#transport = transport;
      this.#lastCheckedAt = new Date().toISOString();

      const health: AdapterHealth = {
        status: 'connected',
        latencyMs,
        lastCheckedAt: this.#lastCheckedAt,
      };
      return ok<AdapterHealth>(health);
    }, 'EMAIL_CONNECT_FAILED');
  }

  // ─── disconnect ───────────────────────────────────────────────────────────

  async disconnect(): Promise<AdapterResult> {
    if (this.#transport) {
      await this.#transport.close().catch(() => { /* best-effort */ });
    }
    this.#transport = null;
    this.#lastCheckedAt = new Date().toISOString();
    return okVoid();
  }

  // ─── getStatus ────────────────────────────────────────────────────────────

  async getStatus(): Promise<AdapterHealth> {
    if (!this.#transport) {
      return { status: 'disconnected', lastCheckedAt: this.#lastCheckedAt };
    }

    try {
      const start = Date.now();
      await this.#transport.verify();
      const latencyMs = Date.now() - start;
      this.#lastCheckedAt = new Date().toISOString();
      return { status: 'connected', latencyMs, lastCheckedAt: this.#lastCheckedAt };
    } catch (thrown) {
      this.#lastCheckedAt = new Date().toISOString();
      return {
        status: 'error',
        lastCheckedAt: this.#lastCheckedAt,
        message: toAdapterError(thrown).message,
      };
    }
  }

  // ─── sync ─────────────────────────────────────────────────────────────────
  // Email is an outbound-only adapter; sync returns an empty summary.

  async sync(_options?: SyncOptions): Promise<AdapterResult<SyncResult>> {
    if (!this.#transport) {
      return err<SyncResult>({
        code: 'NOT_CONNECTED',
        message: 'Call connect() before sync().',
        retryable: false,
      });
    }

    const result: SyncResult = {
      direction: 'outbound',
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    return ok<SyncResult>(result);
  }

  // ─── send (primary action for email adapters) ─────────────────────────────

  async send(message: EmailMessage): Promise<AdapterResult<EmailSendResult>> {
    if (!this.#transport) {
      return err<EmailSendResult>({
        code: 'NOT_CONNECTED',
        message: 'Call connect() before send().',
        retryable: false,
      });
    }

    const messageError = this.#validateMessage(message);
    if (messageError) return err<EmailSendResult>(messageError);

    return tryCatch(async () => {
      const result = await this.#transport!.send(message);
      return ok<EmailSendResult>(result);
    }, 'EMAIL_SEND_FAILED');
  }

  /**
   * Send multiple messages in parallel (with a concurrency cap).
   */
  async sendBatch(
    messages: EmailMessage[],
    concurrency = 5,
  ): Promise<{
    sent: EmailSendResult[];
    failed: Array<{ message: EmailMessage; error: AdapterError }>;
  }> {
    const sent: EmailSendResult[] = [];
    const failed: Array<{ message: EmailMessage; error: AdapterError }> = [];

    for (let i = 0; i < messages.length; i += concurrency) {
      const chunk = messages.slice(i, i + concurrency);
      const results = await Promise.allSettled(chunk.map((m) => this.send(m)));

      for (let j = 0; j < results.length; j++) {
        const result = results[j]!;
        const msg = chunk[j]!;
        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          sent.push(result.value.data);
        } else {
          const error =
            result.status === 'rejected'
              ? toAdapterError(result.reason, 'EMAIL_SEND_FAILED')
              : (result as PromiseFulfilledResult<AdapterResult<EmailSendResult>>).value.error!;
          failed.push({ message: msg, error });
        }
      }
    }

    return { sent, failed };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #validateConfig(config: EmailConfig): AdapterError | undefined {
    if (config.provider === 'smtp') {
      return validateRequiredFields(config, ['host', 'port', 'fromAddress']);
    }
    if (config.provider === 'sendgrid') {
      return validateRequiredFields(config, ['apiKey', 'fromAddress']);
    }
    if (config.provider === 'mailgun') {
      return validateRequiredFields(config, ['apiKey', 'domain', 'fromAddress']);
    }
    return {
      code: 'UNKNOWN_PROVIDER',
      message: `Unknown email provider: ${(config as { provider: string }).provider}`,
      retryable: false,
    };
  }

  #validateMessage(message: EmailMessage): AdapterError | undefined {
    if (!message.subject?.trim()) {
      return { code: 'INVALID_MESSAGE', message: 'Email subject is required.', retryable: false };
    }
    if (!message.text && !message.html) {
      return { code: 'INVALID_MESSAGE', message: 'Email must have a text or html body.', retryable: false };
    }
    const recipients = Array.isArray(message.to) ? message.to : [message.to];
    const invalid = recipients.filter((r) => !isValidEmail(r.address));
    if (invalid.length > 0) {
      return {
        code: 'INVALID_RECIPIENTS',
        message: `Invalid recipient addresses: ${invalid.map((r) => r.address).join(', ')}`,
        retryable: false,
      };
    }
    return undefined;
  }

  #buildTransport(config: EmailConfig): IEmailTransport {
    if (this.transportFactory) return this.transportFactory(config);

    switch (config.provider) {
      case 'smtp':
        return new SmtpTransport(config);
      case 'sendgrid':
        return new SendGridTransport(config);
      case 'mailgun':
        return new MailgunTransport(config);
    }
  }
}

// ─── SMTP Transport ───────────────────────────────────────────────────────────

class SmtpTransport implements IEmailTransport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #transporter: any;
  readonly #config: SmtpConfig;
  readonly #provider: EmailProvider = 'smtp';

  constructor(config: SmtpConfig) {
    this.#config = config;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      this.#transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });
    } catch {
      throw new Error('The "nodemailer" package is required. Install it: pnpm add nodemailer');
    }
  }

  async verify(): Promise<void> {
    await this.#transporter.verify();
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const fromAddress = this.#config.fromName
      ? `"${this.#config.fromName}" <${this.#config.fromAddress}>`
      : this.#config.fromAddress;

    const info = await this.#transporter.sendMail({
      from: fromAddress,
      to: formatAddressList(message.to),
      cc: message.cc ? formatAddressList(message.cc) : undefined,
      bcc: message.bcc ? formatAddressList(message.bcc) : undefined,
      replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
        encoding: a.encoding,
      })),
    });

    return {
      messageId: info.messageId as string,
      provider: this.#provider,
      accepted: (info.accepted as string[]) ?? [],
      rejected: (info.rejected as string[]) ?? [],
      sentAt: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    this.#transporter.close();
  }
}

// ─── SendGrid Transport ───────────────────────────────────────────────────────

class SendGridTransport implements IEmailTransport {
  readonly #config: SendGridConfig;
  readonly #provider: EmailProvider = 'sendgrid';

  constructor(config: SendGridConfig) {
    this.#config = config;
  }

  async verify(): Promise<void> {
    const response = await fetch('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${this.#config.apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`SendGrid API key validation failed: ${response.status} ${response.statusText}`);
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = this.#config.fromName
      ? { email: this.#config.fromAddress, name: this.#config.fromName }
      : { email: this.#config.fromAddress };

    const toList = (Array.isArray(message.to) ? message.to : [message.to]).map((a) => ({
      email: a.address,
      name: a.name,
    }));

    const body = {
      personalizations: [{ to: toList }],
      from,
      subject: message.subject,
      content: [
        ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
        ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
      ],
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content:
          typeof a.content === 'string'
            ? Buffer.from(a.content).toString('base64')
            : a.content.toString('base64'),
        type: a.contentType,
        disposition: 'attachment',
      })),
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid send failed: ${response.status} ${text}`);
    }

    const messageId = response.headers.get('X-Message-Id') ?? crypto.randomUUID();

    return {
      messageId,
      provider: this.#provider,
      accepted: toList.map((t) => t.email),
      rejected: [],
      sentAt: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    // No persistent connection to close.
  }
}

// ─── Mailgun Transport ────────────────────────────────────────────────────────

class MailgunTransport implements IEmailTransport {
  readonly #config: MailgunConfig;
  readonly #provider: EmailProvider = 'mailgun';

  constructor(config: MailgunConfig) {
    this.#config = config;
  }

  get #baseUrl(): string {
    return this.#config.region === 'eu'
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3';
  }

  #authHeader(): string {
    return `Basic ${Buffer.from(`api:${this.#config.apiKey}`).toString('base64')}`;
  }

  async verify(): Promise<void> {
    const url = `${this.#baseUrl}/domains/${this.#config.domain}`;
    const response = await fetch(url, {
      headers: { Authorization: this.#authHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mailgun domain verification failed: ${response.status} ${response.statusText}`);
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = this.#config.fromName
      ? `${this.#config.fromName} <${this.#config.fromAddress}>`
      : this.#config.fromAddress;

    const toList = (Array.isArray(message.to) ? message.to : [message.to]).map(formatAddress);

    const formData = new FormData();
    formData.set('from', from);
    formData.set('to', toList.join(', '));
    formData.set('subject', message.subject);
    if (message.text) formData.set('text', message.text);
    if (message.html) formData.set('html', message.html);

    if (message.cc) {
      const ccList = (Array.isArray(message.cc) ? message.cc : [message.cc]).map(formatAddress);
      formData.set('cc', ccList.join(', '));
    }

    if (message.bcc) {
      const bccList = (Array.isArray(message.bcc) ? message.bcc : [message.bcc]).map(formatAddress);
      formData.set('bcc', bccList.join(', '));
    }

    if (message.tags) {
      for (const [key, value] of Object.entries(message.tags)) {
        formData.append('o:tag', `${key}:${value}`);
      }
    }

    const url = `${this.#baseUrl}/${this.#config.domain}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: this.#authHeader() },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mailgun send failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { id: string; message: string };

    return {
      messageId: data.id,
      provider: this.#provider,
      accepted: toList,
      rejected: [],
      sentAt: new Date().toISOString(),
    };
  }

  async close(): Promise<void> {
    // No persistent connection to close.
  }
}

// ─── Address format helpers ───────────────────────────────────────────────────

function formatAddress(a: EmailAddress): string {
  return a.name ? `"${a.name}" <${a.address}>` : a.address;
}

function formatAddressList(a: EmailAddress | EmailAddress[]): string {
  const list = Array.isArray(a) ? a : [a];
  return list.map(formatAddress).join(', ');
}
