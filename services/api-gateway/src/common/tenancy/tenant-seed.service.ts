import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_TENANT_ID } from './tenancy.config';

/**
 * Ensures the implicit default tenant exists and backfills existing users to it
 * (SaaS phase 4.1). Idempotent and safe to run on every boot in BOTH deployment
 * modes:
 *
 *  - self-host : the default tenant is the only tenant; all users belong to it.
 *  - saas      : the default tenant is the backfill target for pre-tenancy rows;
 *                new tenants are created by signup, not here.
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
      await this.ensureDefaultTenant();
    } catch (err) {
      this.logger.warn(
        `Default-tenant seed skipped: ${(err as Error).message} (run "npx prisma db push" first)`,
      );
    }
  }

  /** Create the default tenant if missing and backfill users with no tenant. */
  async ensureDefaultTenant(): Promise<void> {
    await this.prisma.tenant.upsert({
      where: { id: DEFAULT_TENANT_ID },
      update: {},
      create: {
        id: DEFAULT_TENANT_ID,
        slug: 'default',
        name: 'Default',
        status: 'ACTIVE',
        plan: 'STARTER',
      },
    });

    const backfilled = await this.prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: DEFAULT_TENANT_ID },
    });

    if (backfilled.count > 0) {
      this.logger.log(
        `Backfilled ${backfilled.count} user(s) to the default tenant.`,
      );
    }
  }
}
