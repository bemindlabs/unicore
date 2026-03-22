import { Module, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { SettingsController, TENANT_CONTEXT_PROVIDER } from './settings.controller';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [LicenseModule],
  controllers: [SettingsController],
  providers: [
    {
      provide: TENANT_CONTEXT_PROVIDER,
      scope: Scope.REQUEST,
      useFactory: (req: Request) => ({
        get: () => {
          // Enterprise TenantMiddleware sets req.tenant (TenantContext with id field)
          const tenant = (req as any).tenant;
          if (tenant?.id) return { tenantId: tenant.id };
          // DomainRoutingMiddleware sets req.tenantId for custom domain routing
          const tenantId = (req as any).tenantId;
          if (tenantId) return { tenantId };
          // Community/Pro: no tenant context → global branding
          return null;
        },
      }),
      inject: [REQUEST],
    },
  ],
})
export class SettingsModule {}
