/**
 * Trial lifecycle email templates (M3/E3).
 *
 * Sent via the M1 EmailService (Resend-backed, logged no-op when unconfigured)
 * by the daily trial scheduler. Milestones: T-7, T-3, T-1 reminders and a T-0
 * expiry/suspension notice.
 */

/** Days before expiry a reminder fires. 0 = the expiry day itself. */
export type TrialReminderMilestone = 7 | 3 | 1 | 0;

export interface TrialReminderData {
  name: string;
  businessName: string;
  daysRemaining: number;
  upgradeUrl: string;
}

export interface TrialExpiredData {
  name: string;
  businessName: string;
  upgradeUrl: string;
  /** Days the suspended data is retained before purge. */
  retentionDays: number;
}

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

/** Subject line for a reminder milestone. */
export function trialReminderSubject(daysRemaining: number, businessName: string): string {
  if (daysRemaining <= 0) return `Your UniCore trial ends today — ${businessName}`;
  if (daysRemaining === 1) return `Your UniCore trial ends tomorrow — ${businessName}`;
  return `${daysRemaining} days left in your UniCore trial — ${businessName}`;
}

/** Reminder email body (T-7 / T-3 / T-1 / T-0). */
export function trialReminderEmailHtml(data: TrialReminderData): string {
  const { name, businessName, daysRemaining, upgradeUrl } = data;
  const when =
    daysRemaining <= 0
      ? 'ends today'
      : daysRemaining === 1
        ? 'ends tomorrow'
        : `ends in ${daysRemaining} days`;
  return shell(`
    <h1 style="color: #18181b; font-size: 24px;">Hi ${name}, your trial ${when}</h1>
    <p style="color: #52525b; font-size: 16px; line-height: 1.6;">
      Your free trial for <strong>${businessName}</strong> ${when}. Add a payment
      method now to keep your workspace running without interruption — your data
      and settings stay exactly as they are.
    </p>
    ${cta(upgradeUrl, 'Choose a plan')}
    <p style="color: #71717a; font-size: 13px;">No charge until you confirm a plan.</p>
  `);
}

/** Expiry / suspension notice (sent at T-0 when the tenant is suspended). */
export function trialExpiredEmailHtml(data: TrialExpiredData): string {
  const { name, businessName, upgradeUrl, retentionDays } = data;
  return shell(`
    <h1 style="color: #18181b; font-size: 24px;">Your UniCore trial has ended</h1>
    <p style="color: #52525b; font-size: 16px; line-height: 1.6;">
      Hi ${name}, the free trial for <strong>${businessName}</strong> has ended and
      your workspace is now in read-only mode. Upgrade to restore full access.
    </p>
    ${cta(upgradeUrl, 'Reactivate with a plan')}
    <p style="color: #71717a; font-size: 13px;">
      Your data is retained for ${retentionDays} days. Upgrade any time before then to pick up where you left off.
    </p>
  `);
}
