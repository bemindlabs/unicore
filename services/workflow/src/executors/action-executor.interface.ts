/**
 * Shared interface for all action executors.
 */
import type { WorkflowAction } from '../schema/workflow-definition.schema';

export interface ActionExecutionContext {
  /** The trigger event payload that started the workflow. */
  triggerPayload: unknown;
  /**
   * Outputs produced by previously completed actions within this instance.
   * Key = action.id, value = executor output.
   */
  previousOutputs: Record<string, unknown>;
  /** Unique workflow instance ID (for logging / correlation). */
  instanceId: string;
  /** Name of the parent workflow (for logging). */
  workflowName: string;
}

export interface ActionExecutionResult {
  /** Whether the action completed without error. */
  success: boolean;
  /** Arbitrary output that downstream actions can reference. */
  output?: unknown;
  /** Error message when success === false. */
  error?: string;
}

export interface IActionExecutor<T extends WorkflowAction = WorkflowAction> {
  /** The action.type this executor handles. */
  readonly actionType: T['type'];
  /**
   * Execute the action.
   * Must resolve (not reject) even on failure — return success:false instead.
   */
  execute(action: T, context: ActionExecutionContext): Promise<ActionExecutionResult>;
}
