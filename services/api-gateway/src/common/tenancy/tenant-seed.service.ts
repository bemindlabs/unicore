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
    } catch (err) {
      this.logger.warn(
        `Demo-tenant seed skipped: ${(err as Error).message} (run "npx prisma db push" first)`,
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
