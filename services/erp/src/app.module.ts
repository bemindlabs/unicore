import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { KafkaModule } from './kafka/kafka.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Root module for the UniCore ERP microservice (port 4100).
 *
 * Feature modules for Contacts, Orders, Inventory, Invoices, Expenses,
 * and Reports will be imported here once implemented in subsequent tickets.
 */
@Module({
  imports: [
    PrismaModule,
    KafkaModule,
    HealthModule,
  ],
})
export class AppModule {}
