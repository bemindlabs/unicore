/**
 * WorkflowEngineModule — NestJS module wiring for the entire workflow package.
 */
import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ActionExecutorService } from '../engine/action-executor.service';
import { WorkflowStateStore } from '../state/workflow-state.store';
import { CallAgentExecutor } from '../executors/call-agent.executor';
import { UpdateErpExecutor } from '../executors/update-erp.executor';
import { SendNotificationExecutor } from '../executors/send-notification.executor';

@Module({
  controllers: [WorkflowController],
  providers: [
    // Application layer
    WorkflowService,
    // Core engine
    WorkflowEngineService,
    ActionExecutorService,
    // State
    WorkflowStateStore,
    // Action executors
    CallAgentExecutor,
    UpdateErpExecutor,
    SendNotificationExecutor,
  ],
  exports: [WorkflowService, WorkflowEngineService],
})
export class WorkflowEngineModule {}
