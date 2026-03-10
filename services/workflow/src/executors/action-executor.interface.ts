import type { WorkflowAction } from '../schema/workflow-definition.schema';

export interface ActionExecutionContext {
  triggerPayload: unknown;
  previousOutputs: Record<string, unknown>;
  instanceId: string;
  workflowName: string;
}

export interface ActionExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export interface IActionExecutor<T extends WorkflowAction = WorkflowAction> {
  readonly actionType: T['type'];
  execute(action: T, context: ActionExecutionContext): Promise<ActionExecutionResult>;
}
