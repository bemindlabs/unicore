/**
 * WorkflowEngineModule — NestJS module wiring for the workflow service.
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
    WorkflowService,
    WorkflowEngineService,
    ActionExecutorService,
    WorkflowStateStore,
    CallAgentExecutor,
    UpdateErpExecutor,
    SendNotificationExecutor,
  ],
  exports: [WorkflowService, WorkflowEngineService],
})
export class WorkflowEngineModule {}
