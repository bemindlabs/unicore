import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { PrismaModule } from './prisma/prisma.module';
import { ContactsModule } from './contacts/contacts.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReportsModule } from './reports/reports.module';

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
})
export class AppModule {}
