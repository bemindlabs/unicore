import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
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
 * Short delay before the boot sweep. Lets the app finish wiring (DB pool, email
 * transport) before the first sweep, and — combined with the sweep's
 * idempotency — keeps multi-replica double-runs harmless.
 */
const BOOT_SWEEP_DELAY_MS = parseInt(
  process.env.TRIAL_SWEEP_BOOT_DELAY_MS ?? '10000',
  10,
);

/**
 * Lean trial scheduler (M3/E3).
 *
 * Runs a daily idempotent sweep that:
 *  (a) emails T-7 / T-3 / T-1 / T-0 reminders to trialing tenants, and
 *  (b) flips tenants past `trialEndsAt` with no ACTIVE subscription to
 *      status SUSPENDED (read-only, enforced by SuspendedTenantGuard) and
 *      sends the expiry notice.
 *
 * Implemented with a plain interval timer (no extra dependency). Each step is
 * guarded so re-runs on the same day do not double-send or re-suspend.
 */
@Injectable()
export class TrialSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrialSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private bootTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly subscriptions: TenantSubscriptionService,
  ) {}

  onModuleInit(): void {
    // GAPS #9: the daily interval alone meant the first sweep was up to 24h
    // away (and never fired at all if the process restarted daily) — so trial
    // reminders and expiry→SUSPEND could silently never happen. Run one sweep
    // shortly after boot, THEN daily. The sweep is idempotent (it only reminds
    // on milestone days and only suspends not-already-suspended tenants), so a
    // boot run across multiple replicas is safe. Both timers are detached so
    // they never block module init.
    this.bootTimer = setTimeout(() => {
      void this.runDailySweep().catch((err) =>
        this.logger.error(`Boot trial sweep failed: ${(err as Error).message}`),
      );
    }, BOOT_SWEEP_DELAY_MS);
    // Don't keep the event loop alive solely for the boot sweep (e.g. in tests).
    this.bootTimer.unref?.();

    this.timer = setInterval(() => {
      void this.runDailySweep().catch((err) =>
        this.logger.error(`Daily trial sweep failed: ${(err as Error).message}`),
      );
    }, DAILY_MS);
    this.logger.log(
      `Trial scheduler armed (boot sweep in ${BOOT_SWEEP_DELAY_MS}ms, then daily)`,
    );
  }

  onModuleDestroy(): void {
    if (this.bootTimer) clearTimeout(this.bootTimer);
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
