import { Module } from '@nestjs/common';
import { TemplateLoaderService } from '../loader/template-loader.service';
import { TemplateRegistryService } from '../registry/template-registry.service';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplateBootstrapService } from './workflow-template-bootstrap.service';
import { WorkflowEngineModule } from '../workflow/workflow-engine.module';

/**
 * WorkflowTemplatesModule provides the pre-built workflow template system.
 *
 * Flow on startup:
 *   1. TemplateLoaderService reads JSON files from templates/definitions/.
 *   2. TemplateRegistryService validates and indexes them by trigger type.
 *   3. WorkflowTemplateBootstrapService loads enabled definitions into
 *      WorkflowEngineService (from WorkflowEngineModule) so the engine
 *      can match and execute them when Kafka events arrive.
 *
 * WorkflowEngineModule is imported (not re-declared) to reuse the engine
 * instance shared with KafkaConsumerModule.
 */
@Module({
  imports: [WorkflowEngineModule],
  controllers: [WorkflowTemplatesController],
  providers: [
    TemplateLoaderService,
    TemplateRegistryService,
    WorkflowTemplateBootstrapService,
  ],
  exports: [TemplateRegistryService],
})
export class WorkflowTemplatesModule {}
