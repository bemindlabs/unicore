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
import { DEMO_TENANT_ID } from '../common/tenancy/tenancy.config';

/** How often the daily sweep runs (24h). */
const DAILY_MS = 24 * 60 * 60 * 1000;
/**
 * Suspended-data retention window (GAPS #10). A tenant SUSPENDED for longer than
 * this is purged. Quoted in the expiry email and configurable via RETENTION_DAYS.
 */
const RETENTION_DAYS = Math.max(
  1,
  parseInt(process.env.RETENTION_DAYS ?? '30', 10) || 30,
);

/**
 * Gateway MAIN-DB tables carrying a tenant id, purged for a retention-expired
 * tenant. Derived from scripts/tenant-backup.sh GATEWAY_TABLES, MINUS:
 *   - "User"      — identity-level; a user may own OTHER tenants (Membership),
 *                   so deleting users here would orphan their other businesses;
 *   - audit_logs  — the compliance trail (incl. the purge audit) must survive.
 * PascalCase names are quoted (Postgres folds unquoted to lowercase). The ERP
 * DB is a SEPARATE database the gateway has no connection to — its tenant-scoped
 * purge is delegated to scripts/tenant-backup.sh --purge.
 */
const GATEWAY_TENANT_TABLES = [
  'conversations',
  'contact_channels',
  'chat_histories',
  'tasks',
  '"Settings"',
  'custom_domains',
] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
 *  (a) emails T-7 / T-3 / T-1 / T-0 reminders to trialing tenants,
 *  (b) flips tenants past `trialEndsAt` with no ACTIVE subscription to
 *      status SUSPENDED (read-only, enforced by SuspendedTenantGuard) and
 *      sends the expiry notice, and
 *  (c) (GAPS #10) PURGES the tenant-scoped data of tenants that have been
 *      SUSPENDED for longer than RETENTION_DAYS — a final-warning email, an
 *      audit log, then a guarded delete across the gateway tenant tables. The
 *      demo/zero tenant is never purged; the step is idempotent (a purged tenant
 *      is marked ARCHIVED so it is not reselected).
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
  async runDailySweep(
    now: Date = new Date(),
  ): Promise<{ reminded: number; suspended: number; purged: number }> {
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

    // ---- (c) Retention purge of long-SUSPENDED tenants (GAPS #10) -----------
    const purged = await this.purgeExpiredSuspendedTenants(now);

    if (reminded || suspended || purged) {
      this.logger.log(
        `Trial sweep complete: ${reminded} reminder(s), ${suspended} suspension(s), ${purged} purge(s)`,
      );
    }
    return { reminded, suspended, purged };
  }

  /**
   * GAPS #10 — purge tenant-scoped data for tenants SUSPENDED longer than
   * RETENTION_DAYS. Idempotent + guarded:
   *   - selects ONLY status=SUSPENDED tenants whose `updatedAt` (the suspend
   *     timestamp) is older than the retention cutoff;
   *   - NEVER touches the demo/zero tenant;
   *   - sends a final-warning email + writes an audit log BEFORE deleting;
   *   - deletes the gateway tenant tables via unscoped raw SQL (the scheduler
   *     runs outside any request, so it must not rely on RLS request context),
   *     then marks the tenant ARCHIVED so a re-run never reselects it.
   * The ERP DB purge is delegated to scripts/tenant-backup.sh --purge.
   */
  async purgeExpiredSuspendedTenants(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.tenant.findMany({
      where: {
        status: 'SUSPENDED',
        updatedAt: { lt: cutoff },
        id: { not: DEMO_TENANT_ID },
      },
    });

    let purged = 0;
    for (const tenant of candidates) {
      // Defense-in-depth: never purge the demo/zero tenant, even if a bad query
      // somehow selected it, and never purge a non-UUID id.
      if (tenant.id === DEMO_TENANT_ID || !UUID_RE.test(tenant.id)) {
        this.logger.warn(`Skipping retention purge for protected tenant ${tenant.id}`);
        continue;
      }

      // Final warning email to the owner BEFORE the irreversible delete.
      const owner = await this.prisma.user.findFirst({
        where: { tenantId: tenant.id, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { email: true, name: true },
      });
      if (owner) {
        await this.email.send({
          to: owner.email,
          subject: `Final notice — ${tenant.name} data is being deleted`,
          html: `<p>Hi ${owner.name},</p><p>Your UniCore workspace <strong>${tenant.name}</strong> has been suspended for more than ${RETENTION_DAYS} days. As stated when the trial ended, its data is now being permanently deleted. If this is a mistake, contact support immediately.</p><p>— UniCore, operated by Bemind Technology Co., Ltd.</p>`,
        });
      }

      // Audit log BEFORE the delete, scoped to the tenant being purged. Written
      // via raw SQL so it does not depend on the RLS request context (and so it
      // survives even though the User rows are about to go).
      await this.writePurgeAudit(tenant.id, owner?.email ?? null, tenant.name);

      // Delete the tenant-scoped business data, all tenantId-filtered. Users are
      // identity-level (a user may own OTHER tenants via Membership), so we do
      // NOT delete User rows here — only the suspended tenant's data.
      //
      // CRITICAL (RLS): several of these tables are FORCE ROW LEVEL SECURITY
      // (scripts/apply-rls.sql). A raw DELETE issued without `app.tenant_id` set
      // matches ZERO rows (the policy compares against NULL), so the purge would
      // silently delete nothing. We therefore run the deletes inside ONE
      // transaction that first SET LOCAL app.tenant_id to the TARGET tenant, so
      // the RLS policy permits deleting exactly that tenant's rows.
      //
      // NOTE: the gateway DB column is "tenantId" (camelCase), NOT snake_case —
      // Prisma does not map it (see apply-rls.sql, which also filters on
      // "tenantId"). The column is `uuid` on RLS tables but plain `text` on
      // custom_domains, so we compare `::text` to cover both uniformly.
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenant.id}'`);
        for (const table of GATEWAY_TENANT_TABLES) {
          await tx.$executeRawUnsafe(
            `DELETE FROM ${table} WHERE "tenantId"::text = $1`,
            tenant.id,
          );
        }
      });

      // Mark ARCHIVED (idempotency: the next sweep's SUSPENDED filter skips it).
      // We keep the tenant row + membership shells so the user can still log in
      // and re-onboard; the tenant-scoped business data is gone.
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ARCHIVED' },
      });

      purged += 1;
      this.logger.warn(
        `Retention purge: tenant ${tenant.id} (${tenant.slug}) data deleted after >${RETENTION_DAYS}d suspended; marked ARCHIVED`,
      );
    }

    return purged;
  }

  /** Insert an audit row for a purge, unscoped (raw SQL), tagged with the tenant. */
  private async writePurgeAudit(
    tenantId: string,
    userEmail: string | null,
    tenantName: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs (id, tenant_id, "userEmail", action, resource, detail, success)
         VALUES (gen_random_uuid(), $1::uuid, $2, 'purge', 'tenants', $3, true)`,
        tenantId,
        userEmail,
        `Retention purge: ${tenantName} suspended > ${RETENTION_DAYS}d`,
      );
    } catch (err) {
      // Never let an audit failure block the purge; just log loudly.
      this.logger.error(`Failed to write purge audit for ${tenantId}: ${(err as Error).message}`);
    }
  }
}
