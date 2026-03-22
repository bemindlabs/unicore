import { Module } from '@nestjs/common';
import { OrderConsumerService } from './consumers/order.consumer';
import { InventoryConsumerService } from './consumers/inventory.consumer';
import { InvoiceConsumerService } from './consumers/invoice.consumer';
import { EventHandlerService } from './event-handler.service';
import { DlqService } from './dlq/dlq.service';
import { DlqController } from './dlq/dlq.controller';
import { RetryService } from './retry/retry.service';
import { WorkflowEngineModule } from '../workflow/workflow-engine.module';

/**
 * KafkaConsumerModule wires together all topic-specific consumer services,
 * the central EventHandlerService, RetryService, and DlqService.
 *
 * Imports WorkflowEngineModule so consumer services can inject WorkflowService
 * and forward deserialized events into the workflow engine.
 *
 * The Kafka microservice transport is registered in main.ts via
 * app.connectMicroservice(buildKafkaOptions()).
 *
 * Retry/DLQ flow:
 *   Consumer → RetryService (exponential backoff) → DlqService (on exhaustion)
 *   DlqController exposes GET /dlq and POST /dlq/:id/retry for operators.
 */
@Module({
  imports: [WorkflowEngineModule],
  controllers: [DlqController],
  providers: [
    EventHandlerService,
    DlqService,
    RetryService,
    OrderConsumerService,
    InventoryConsumerService,
    InvoiceConsumerService,
  ],
  exports: [EventHandlerService, DlqService, RetryService],
})
export class KafkaConsumerModule {}
