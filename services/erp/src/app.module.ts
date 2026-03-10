import { Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';

/**
 * Root application module for the ERP microservice.
 *
 * Imports:
 * - KafkaModule        — Kafka producer client + EventPublisherService
 * - OrdersModule       — order.created / order.updated / order.fulfilled
 * - InventoryModule    — inventory.low / inventory.restocked
 * - InvoicesModule     — invoice.created / invoice.overdue / invoice.paid
 */
@Module({
  imports: [KafkaModule, OrdersModule, InventoryModule, InvoicesModule],
})
export class AppModule {}
