/**
 * Auth lifecycle email templates (GAPS #8).
 *
 * Sent via the M1 EmailService (Resend-backed, logged no-op when unconfigured):
 *  - email verification (after signup/register)
 *  - password reset (forgot-password)
 *
 * The link carries a raw, single-use, time-limited token; only its sha256 hash
 * is persisted (see AuthService). Tenant-agnostic — identity-level emails.
 */

const shell = (inner: string): string => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    ${inner}
    <div style="border-top: 1px solid #e4e4e7; margin-top: 32px; padding-top: 24px;">
      <p style="color: #a1a1aa; font-size: 12px; margin: 0;">UniCore — operated by Bemind Technology Co., Ltd.</p>
    </div>
  </div>`;

const cta = (url: string, label: string): string => `
  <p style="margin: 24px 0;">
    <a href="${url}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px;">${label}</a>
  </p>`;

export interface VerifyEmailData {
  name: string;
  verifyUrl: string;
}

export interface ResetPasswordEmailData {
  name: string;
  resetUrl: string;
  /** Token lifetime in minutes, quoted in the body. */
  expiresMinutes: number;
}

/** "Verify your email" body sent after signup/register. */
export function verifyEmailHtml(data: VerifyEmailData): string {
  const { name, verifyUrl } = data;
  return shell(`
    <h1 style="color: #18181b; font-size: 24px;">Welcome, ${name} — confirm your email</h1>
    <p style="color: #52525b; font-size: 16px; line-height: 1.6;">
      Please confirm this is your email address to secure your UniCore account.
    </p>
    ${cta(verifyUrl, 'Verify email')}
    <p style="color: #71717a; font-size: 13px;">
      If you didn't create a UniCore account, you can safely ignore this email.
    </p>
  `);
}

/** "Reset your password" body sent on forgot-password (only when the user exists). */
export function resetPasswordEmailHtml(data: ResetPasswordEmailData): string {
  const { name, resetUrl, expiresMinutes } = data;
  return shell(`
    <h1 style="color: #18181b; font-size: 24px;">Reset your password</h1>
    <p style="color: #52525b; font-size: 16px; line-height: 1.6;">
      Hi ${name}, we received a request to reset your UniCore password. Click below
      to choose a new one. This link expires in ${expiresMinutes} minutes and can
      be used once.
    </p>
    ${cta(resetUrl, 'Reset password')}
    <p style="color: #71717a; font-size: 13px;">
      If you didn't request this, ignore this email — your password stays unchanged.
    </p>
  `);
}
