import { Module } from '@nestjs/common';
import { WorkflowEngineModule } from './workflow/workflow-engine.module';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';
import { WorkflowTemplatesModule } from './module/workflow-templates.module';

/**
 * Root application module for the workflow service.
 *
 * WorkflowEngineModule      — core engine, REST controller, state store.
 * KafkaConsumerModule        — Kafka topic consumers that forward events into the engine.
 * WorkflowTemplatesModule   — pre-built template loader, registry, and REST endpoints.
 */
@Module({
  imports: [WorkflowEngineModule, KafkaConsumerModule, WorkflowTemplatesModule],
})
export class AppModule {}
