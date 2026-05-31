import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEMO_TENANT_ID } from './tenancy.config';

/**
 * Seeds a local/demo bootstrap tenant for development and demos, and backfills
 * any tenant-less users into it (SaaS phase 4.1). Idempotent and safe to run on
 * every boot.
 *
 * This is demo/bootstrap data only — UniCore is multi-tenant SaaS, and real
 * tenants are created by self-serve signup, not here. The demo tenant gives a
 * fresh local install something to log into.
 *
 * Runs on module init. Failures are logged but never crash the gateway — on a
 * fresh deploy the table may not exist until `prisma db push` has run.
 */
@Injectable()
export class TenantSeedService implements OnModuleInit {
  private readonly logger = new Logger(TenantSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDemoTenant();
      await this.backfillMemberships();
    } catch (err) {
      this.logger.warn(
        `Demo-tenant seed skipped: ${(err as Error).message} (run "npx prisma db push" first)`,
      );
    }
  }

  /**
   * Idempotent membership backfill (Phase 5 / W1a). Every existing user gets a
   * Membership to their current tenant (role = user.role || OWNER) and has
   * activeTenantId set to that tenant. Safe to run on every boot: the unique
   * (userId, tenantId) constraint + skipDuplicates make re-runs no-ops.
   */
  async backfillMemberships(): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { tenantId: { not: null } },
      select: { id: true, role: true, tenantId: true, activeTenantId: true },
    });

    if (users.length === 0) return;

    const created = await this.prisma.membership.createMany({
      data: users.map((u) => ({
        userId: u.id,
        tenantId: u.tenantId as string,
        role: u.role,
      })),
      skipDuplicates: true,
    });

    // Set activeTenantId for users that don't have one yet (default to home tenant).
    const missingActive = users.filter((u) => !u.activeTenantId);
    let activated = 0;
    for (const u of missingActive) {
      await this.prisma.user.update({
        where: { id: u.id },
        data: { activeTenantId: u.tenantId },
      });
      activated += 1;
    }

    if (created.count > 0 || activated > 0) {
      this.logger.log(
        `Membership backfill: created ${created.count} membership(s), set ${activated} activeTenantId(s).`,
      );
    }
  }

  /** Create the demo tenant if missing and backfill users with no tenant. */
  async ensureDemoTenant(): Promise<void> {
    await this.prisma.tenant.upsert({
      where: { id: DEMO_TENANT_ID },
      update: {},
      create: {
        id: DEMO_TENANT_ID,
        slug: 'demo',
        name: 'Demo',
        status: 'ACTIVE',
        plan: 'STARTER',
      },
    });

    const backfilled = await this.prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: DEMO_TENANT_ID },
    });

    if (backfilled.count > 0) {
      this.logger.log(
        `Backfilled ${backfilled.count} user(s) to the demo tenant.`,
      );
    }
  }
}
