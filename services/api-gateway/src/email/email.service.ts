import { Injectable, Logger } from '@nestjs/common';

/** Minimal payload accepted by {@link EmailService.send}. */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

/** Data used to render the welcome email sent after wizard provisioning. */
export interface WelcomeEmailData {
  adminName: string;
  adminEmail: string;
  licenseKey?: string;
  businessName: string;
  dashboardUrl: string;
  agentsEnabled: string[];
  erpModulesEnabled: string[];
}

/**
 * Minimal transactional email service (E3 foundation).
 *
 * Mirrors the platform's Resend pattern (`unicore-platform/src/lib/email.ts`).
 * Sends through Resend when `RESEND_API_KEY` is configured; otherwise degrades
 * to a logged no-op so self-host deployments without an email provider keep
 * working unchanged. The full trial-email lifecycle is built later in E3.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private get apiKey(): string | undefined {
    return process.env.RESEND_API_KEY || undefined;
  }

  private get fromAddress(): string {
    return process.env.EMAIL_FROM || 'UniCore <noreply@bemind.tech>';
  }

  /**
   * Send a transactional email. Returns `true` when handed off to Resend,
   * `false` when the provider is unconfigured (logged no-op).
   */
  async send(options: SendEmailOptions): Promise<boolean> {
    const { to, subject, html, text, from } = options;

    if (!this.apiKey) {
      this.logger.log(
        `Email provider not configured (RESEND_API_KEY unset) — skipping email "${subject}" to ${Array.isArray(to) ? to.join(', ') : to}`,
      );
      return false;
    }

    try {
      // Lazy import so the dependency is only loaded when actually sending.
      const { Resend } = await import('resend');
      const resend = new Resend(this.apiKey);
      await resend.emails.send({
        from: from || this.fromAddress,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : { text: text ?? '' }),
      } as Parameters<InstanceType<typeof Resend>['emails']['send']>[0]);
      this.logger.log(`Email sent: "${subject}" -> ${Array.isArray(to) ? to.join(', ') : to}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email "${subject}": ${(err as Error).message}`);
      return false;
    }
  }

  /** Send the post-provisioning welcome email. */
  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const { adminName, adminEmail, businessName, dashboardUrl, licenseKey } = data;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #18181b; font-size: 24px;">Welcome to UniCore, ${adminName}!</h1>
        <p style="color: #52525b; font-size: 16px; line-height: 1.6;">
          Your <strong>${businessName}</strong> workspace is ready.
        </p>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px;">Open your dashboard</a>
        </p>
        ${licenseKey ? `<p style="color: #71717a; font-size: 14px;">License key: <code>${licenseKey}</code></p>` : ''}
      </div>
    `;
    return this.send({
      to: adminEmail,
      subject: `Welcome to UniCore, ${businessName} is ready`,
      html,
    });
  }
}
