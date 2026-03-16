import { Module } from '@nestjs/common';
import { TemplateLoaderService } from '../loader/template-loader.service';
import { TemplateRegistryService } from '../registry/template-registry.service';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplateBootstrapService } from './workflow-template-bootstrap.service';
import { WorkflowEngineModule } from '../workflow/workflow-engine.module';

/**
 * WorkflowTemplatesModule wires together the pre-built template system:
 *
 *   TemplateLoaderService   — reads JSON files from disk
 *   TemplateRegistryService — validates and indexes definitions by trigger
 *   WorkflowTemplateBootstrapService — loads registry → engine on startup
 *
 * Imports WorkflowEngineModule to reuse the engine singleton and all its
 * providers (WorkflowEngineService, ActionExecutorService, executors, state).
 */
@Module({
  imports: [WorkflowEngineModule],
  controllers: [WorkflowTemplatesController],
  providers: [
    // Template layer
    TemplateLoaderService,
    TemplateRegistryService,
    WorkflowTemplateBootstrapService,
  ],
  exports: [TemplateRegistryService],
})
export class WorkflowTemplatesModule {}
