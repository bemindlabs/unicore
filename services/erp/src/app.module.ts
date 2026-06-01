import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { PrismaModule } from './prisma/prisma.module';
import { ContactsModule } from './contacts/contacts.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { CommsModule } from './comms/comms.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ErpEventInterceptor } from './kafka/erp-event.interceptor';

/**
 * Root module for the UniCore ERP microservice (port 4100).
 */
@Module({
  imports: [
    PrismaModule,
    KafkaModule.register(),
    HealthModule,
    ContactsModule,
    OrdersModule,
    InventoryModule,
    InvoicesModule,
    ExpensesModule,
    ReportsModule,
    CommsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ErpEventInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Capture the trusted `x-tenant-id` header (forwarded by the api-gateway)
   * into the request-scoped tenant context for every route, so PrismaService
   * can pin `app.tenant_id` per transaction (SaaS phase 4.5).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
