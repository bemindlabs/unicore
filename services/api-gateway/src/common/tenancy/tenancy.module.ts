import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantSeedService } from './tenant-seed.service';

/**
 * Tenancy module (SaaS phase 4.0–4.2). Provides the local/demo bootstrap-tenant
 * seed that runs on boot. The tenancy constants/helpers (`DEMO_TENANT_ID`,
 * `isSaaS`) live in `tenancy.config.ts` as pure values and need no DI.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [TenantSeedService],
  exports: [TenantSeedService],
})
export class TenancyModule {}
