import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { PrismaModule } from './prisma/prisma.module';
import { ContactsModule } from './contacts/contacts.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { ErpEventInterceptor } from './kafka/erp-event.interceptor';

/**
 * Root module for the UniCore ERP microservice (port 4100).
 */
@Module({
  imports: [
    PrismaModule,
    KafkaModule,
    HealthModule,
    ContactsModule,
    OrdersModule,
    InventoryModule,
    InvoicesModule,
    ExpensesModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ErpEventInterceptor,
    },
  ],
})
export class AppModule {}
