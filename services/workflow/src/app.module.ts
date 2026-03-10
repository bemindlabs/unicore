import { Module } from '@nestjs/common';
import { WorkflowEngineModule } from './workflow/workflow-engine.module';
import { WorkflowTemplatesModule } from './module/workflow-templates.module';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';

/**
 * Root application module for the Workflow Engine service (port 4400).
 *
 * WorkflowEngineModule    — core engine, REST controller for /workflows, state store.
 * WorkflowTemplatesModule — pre-built templates loader, registry, HTTP API at
 *                           /workflow/templates, bootstraps definitions into engine.
 * KafkaConsumerModule     — Kafka topic consumers that forward ERP events into
 *                           the engine for automated workflow execution.
 */
@Module({
  imports: [WorkflowEngineModule, WorkflowTemplatesModule, KafkaConsumerModule],
})
export class AppModule {}
