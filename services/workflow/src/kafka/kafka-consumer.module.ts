import { Module } from '@nestjs/common';
import { OrderConsumerService } from './consumers/order.consumer';
import { InventoryConsumerService } from './consumers/inventory.consumer';
import { InvoiceConsumerService } from './consumers/invoice.consumer';
import { EventHandlerService } from './event-handler.service';
import { WorkflowEngineModule } from '../workflow/workflow-engine.module';

/**
 * KafkaConsumerModule wires together all topic-specific consumer services
 * and the central EventHandlerService.
 *
 * Imports WorkflowEngineModule to inject WorkflowEngineService into each
 * consumer so events can trigger matching pre-built workflow templates.
 *
 * The Kafka microservice transport is registered in main.ts via
 * app.connectMicroservice(buildKafkaOptions()).
 */
@Module({
  imports: [WorkflowEngineModule],
  providers: [
    EventHandlerService,
    OrderConsumerService,
    InventoryConsumerService,
    InvoiceConsumerService,
  ],
  exports: [EventHandlerService],
})
export class KafkaConsumerModule {}
