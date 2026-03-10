import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ContactsModule } from './contacts/contacts.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Root application module for the ERP microservice.
 *
 * Modules:
 * - PrismaModule       — global DB client
 * - ContactsModule     — CRUD + lead scoring
 * - OrdersModule       — CRUD + fulfillment state machine + Kafka events
 * - InventoryModule    — CRUD + stock deduction/restock + Kafka events
 * - InvoicesModule     — CRUD + payment recording + Kafka events
 * - ExpensesModule     — CRUD + receipt upload + approval workflow
 * - ReportsModule      — aggregation endpoints + dashboard summary
 */
@Module({
  imports: [
    PrismaModule,
    ContactsModule,
    OrdersModule,
    InventoryModule,
    InvoicesModule,
    ExpensesModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
