import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { isSaaS } from '../common/tenancy/tenancy.config';
import {
  trialReminderEmailHtml,
  trialReminderSubject,
  trialExpiredEmailHtml,
} from '../email/templates/trial-emails';
import { TenantSubscriptionService } from './tenant-subscription.service';
import { trialDaysRemaining } from '../common/tenancy/plans.config';

/** How often the daily sweep runs (24h). */
const DAILY_MS = 24 * 60 * 60 * 1000;
/** Suspended-data retention window quoted in the expiry email. */
const RETENTION_DAYS = 30;

/**
 * Lean trial scheduler (M3/E3) — saas-mode only.
 *
 * Runs a daily idempotent sweep that:
 *  (a) emails T-7 / T-3 / T-1 / T-0 reminders to trialing tenants, and
 *  (b) flips tenants past `trialEndsAt` with no ACTIVE subscription to
 *      status SUSPENDED (read-only, enforced by SuspendedTenantGuard) and
 *      sends the expiry notice.
 *
 * Implemented with a plain interval timer (no extra dependency). Self-host is a
 * no-op: the scheduler never arms. Each step is guarded so re-runs on the same
 * day do not double-send or re-suspend.
 */
@Injectable()
export class TrialSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly subscriptions: TenantSubscriptionService,
  ) {}

  onModuleInit(): void {
    if (!isSaaS()) {
      this.logger.log('Trial scheduler disabled (self-host mode)');
      return;
    }
    // Run once shortly after boot, then daily. Detached so it never blocks init.
    this.timer = setInterval(() => {
      void this.runDailySweep();
    }, DAILY_MS);
    this.logger.log('Trial scheduler armed (saas mode, daily sweep)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private get upgradeUrl(): string {
    return process.env.PLATFORM_UPGRADE_URL || 'https://unicore.bemind.tech/billing';
  }

  /**
   * One idempotent pass. Public so it can be invoked directly from tests or an
   * external cron (e.g. a container CronJob hitting an internal trigger).
   */
  async runDailySweep(now: Date = new Date()): Promise<{ reminded: number; suspended: number }> {
    if (!isSaaS()) return { reminded: 0, suspended: 0 };

    let reminded = 0;
    let suspended = 0;

    // ---- (a) Reminders for still-trialing, non-suspended tenants ------------
    const trialing = await this.prisma.tenant.findMany({
      where: { subscriptionStatus: 'TRIALING', status: { not: 'SUSPENDED' } },
    });

    for (const tenant of trialing) {
      const milestone = this.subscriptions.reminderMilestoneFor(tenant.trialEndsAt, now);
      if (milestone === null) continue;

      const owner = await this.prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { email: true, name: true },
      });
      if (!owner) continue;

      const daysRemaining = trialDaysRemaining(tenant.trialEndsAt, now);
      const sent = await this.email.send({
        to: owner.email,
        subject: trialReminderSubject(daysRemaining, tenant.name),
        html: trialReminderEmailHtml({
          name: owner.name,
          businessName: tenant.name,
          daysRemaining,
          upgradeUrl: this.upgradeUrl,
        }),
      });
      if (sent) reminded += 1;
      this.logger.log(
        `Trial reminder T-${milestone} for tenant ${tenant.id} (${tenant.slug}) -> ${owner.email}`,
      );
    }

    // ---- (b) Expiry → SUSPENDED (read-only) ---------------------------------
    // Past trial end, never converted (still TRIALING), not already suspended.
    const expired = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'TRIALING',
        status: { not: 'SUSPENDED' },
        trialEndsAt: { lt: now },
      },
    });

    for (const tenant of expired) {
      // Idempotent: only suspend tenants that are not already suspended.
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'SUSPENDED' },
      });
      suspended += 1;
      this.logger.warn(`Trial expired — tenant ${tenant.id} (${tenant.slug}) SUSPENDED (read-only)`);

      const owner = await this.prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { email: true, name: true },
      });
      if (owner) {
        await this.email.send({
          to: owner.email,
          subject: `Your UniCore trial has ended — ${tenant.name}`,
          html: trialExpiredEmailHtml({
            name: owner.name,
            businessName: tenant.name,
            upgradeUrl: this.upgradeUrl,
            retentionDays: RETENTION_DAYS,
          }),
        });
      }
    }

    if (reminded || suspended) {
      this.logger.log(`Trial sweep complete: ${reminded} reminder(s), ${suspended} suspension(s)`);
    }
    return { reminded, suspended };
  }
}
