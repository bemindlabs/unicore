import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TenantSeedService } from './tenant-seed.service';

/**
 * Tenancy module (SaaS phase 4.0–4.2). Provides the default-tenant seed that
 * runs on boot in both deployment modes. The deployment-mode helpers
 * (`isSaaS`, `getDefaultTenantId`, …) live in `tenancy.config.ts` as pure
 * functions and need no DI.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [TenantSeedService],
  exports: [TenantSeedService],
})
export class TenancyModule {}
