import { Module } from '@nestjs/common';
import { WorkflowEngineModule } from './workflow/workflow-engine.module';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';

/**
 * Root application module for the workflow service.
 *
 * WorkflowEngineModule — core engine, REST controller, state store.
 * KafkaConsumerModule  — Kafka topic consumers that forward events into the engine.
 */
@Module({
  imports: [WorkflowEngineModule, KafkaConsumerModule],
})
export class AppModule {}
