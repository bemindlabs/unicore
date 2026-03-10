// Email-specific types — @unicore/integrations

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun';

// ─── SMTP ────────────────────────────────────────────────────────────────────

export interface SmtpConfig {
  provider: 'smtp';
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  /** Optional display name for the From header. */
  fromName?: string;
  fromAddress: string;
}

// ─── SendGrid ────────────────────────────────────────────────────────────────

export interface SendGridConfig {
  provider: 'sendgrid';
  apiKey: string;
  fromAddress: string;
  fromName?: string;
}

// ─── Mailgun ─────────────────────────────────────────────────────────────────

export interface MailgunConfig {
  provider: 'mailgun';
  apiKey: string;
  domain: string;
  fromAddress: string;
  fromName?: string;
  /** EU or US (defaults to US). */
  region?: 'eu' | 'us';
}

export type EmailConfig = SmtpConfig | SendGridConfig | MailgunConfig;

// ─── Message types ────────────────────────────────────────────────────────────

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: 'base64' | 'utf8' | 'binary';
}

export interface EmailMessage {
  to: EmailAddress | EmailAddress[];
  cc?: EmailAddress | EmailAddress[];
  bcc?: EmailAddress | EmailAddress[];
  subject: string;
  /** Plain-text body (at least one of text/html is required). */
  text?: string;
  /** HTML body. */
  html?: string;
  /** Optional reply-to address. */
  replyTo?: EmailAddress;
  attachments?: EmailAttachment[];
  /** Arbitrary key-value tags for tracking. */
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  messageId: string;
  provider: EmailProvider;
  accepted: string[];
  rejected: string[];
  sentAt: string;
}

export interface EmailDeliveryStatus {
  messageId: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  timestamp: string;
  error?: string;
}
