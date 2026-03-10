/**
 * WorkflowService — application-layer façade over WorkflowEngineService.
 *
 * Provides a clean public API consumed by WorkflowController.
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { WorkflowStateStore } from '../state/workflow-state.store';
import type { WorkflowDefinition } from '../schema/workflow-definition.schema';
import type { WorkflowInstance } from '../state/workflow-instance';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly stateStore: WorkflowStateStore,
  ) {}

  // -------------------------------------------------------------------------
  // Definitions
  // -------------------------------------------------------------------------

  registerDefinition(definition: WorkflowDefinition): WorkflowDefinition {
    this.engine.registerDefinition(definition);
    return definition;
  }

  listDefinitions(): WorkflowDefinition[] {
    return this.engine.listDefinitions();
  }

  getDefinition(workflowId: string): WorkflowDefinition {
    return this.engine.getDefinition(workflowId);
  }

  removeDefinition(workflowId: string): { deleted: boolean } {
    const deleted = this.engine.removeDefinition(workflowId);
    return { deleted };
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  async trigger(
    workflowId: string,
    payload: unknown,
  ): Promise<WorkflowInstance> {
    this.logger.log(`Manual trigger: workflow ${workflowId}`);
    return this.engine.trigger(workflowId, payload ?? {});
  }

  async handleEvent(
    eventType: string,
    payload: unknown,
  ): Promise<WorkflowInstance[]> {
    return this.engine.handleEvent(eventType, payload ?? {});
  }

  // -------------------------------------------------------------------------
  // Instance queries
  // -------------------------------------------------------------------------

  getInstance(instanceId: string): WorkflowInstance {
    const inst = this.stateStore.findById(instanceId);
    if (!inst) {
      throw new NotFoundException(`Workflow instance not found: ${instanceId}`);
    }
    return inst;
  }

  listInstances(): WorkflowInstance[] {
    return this.stateStore.findAll();
  }

  listInstancesByWorkflow(workflowId: string): WorkflowInstance[] {
    return this.stateStore.findByWorkflowId(workflowId);
  }
}
