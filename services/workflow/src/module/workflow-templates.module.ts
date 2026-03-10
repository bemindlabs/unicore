import { Module } from '@nestjs/common';
import { TemplateLoaderService } from '../loader/template-loader.service';
import { TemplateRegistryService } from '../registry/template-registry.service';
import { WorkflowTemplatesController } from './workflow-templates.controller';
import { WorkflowTemplateBootstrapService } from './workflow-template-bootstrap.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ActionExecutorService } from '../engine/action-executor.service';
import { CallAgentExecutor } from '../executors/call-agent.executor';
import { UpdateErpExecutor } from '../executors/update-erp.executor';
import { SendNotificationExecutor } from '../executors/send-notification.executor';
import { WorkflowStateStore } from '../state/workflow-state.store';

/**
 * WorkflowTemplatesModule wires together the pre-built template system:
 *
 *   TemplateLoaderService   — reads JSON files from disk
 *   TemplateRegistryService — validates and indexes definitions by trigger
 *   WorkflowEngineService   — executes definitions when events fire
 *   WorkflowTemplateBootstrapService — loads registry → engine on startup
 *
 * Exported services allow other modules (e.g. KafkaConsumerModule) to
 * inject WorkflowEngineService for event-driven workflow execution.
 */
@Module({
  controllers: [WorkflowTemplatesController],
  providers: [
    // Template layer
    TemplateLoaderService,
    TemplateRegistryService,
    WorkflowTemplateBootstrapService,
    // Engine layer
    WorkflowEngineService,
    ActionExecutorService,
    WorkflowStateStore,
    // Action executors
    CallAgentExecutor,
    UpdateErpExecutor,
    SendNotificationExecutor,
  ],
  exports: [TemplateRegistryService, WorkflowEngineService],
})
export class WorkflowTemplatesModule {}
