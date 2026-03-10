/**
 * Workflow Instance — runtime state of a single workflow execution.
 */

/** Lifecycle state of a workflow instance. */
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Lifecycle state of a single action step within an instance. */
export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Execution record for one action step. */
export interface ActionExecution {
  actionId: string;
  actionType: string;
  label: string;
  status: ActionStatus;
  /** ISO 8601 timestamp when execution started. */
  startedAt?: string;
  /** ISO 8601 timestamp when execution finished. */
  completedAt?: string;
  /** Output produced by the action (agent reply, mutation result, etc.). */
  output?: unknown;
  /** Error message if status === 'failed'. */
  error?: string;
}

/**
 * A workflow instance represents one triggered run of a workflow definition.
 * Persisted to (and loaded from) the WorkflowStateStore.
 */
export interface WorkflowInstance {
  /** Unique instance ID (UUID v4). */
  instanceId: string;
  /** ID of the WorkflowDefinition that spawned this instance. */
  workflowId: string;
  /** Human-readable workflow name (copied from definition for convenience). */
  workflowName: string;
  status: WorkflowStatus;
  /** The trigger event payload that caused the instance to be created. */
  triggerPayload: unknown;
  /** Execution records, one per action step. */
  actions: ActionExecution[];
  /** ISO 8601 timestamp when the instance was created. */
  createdAt: string;
  /** ISO 8601 timestamp of the last status change. */
  updatedAt: string;
  /** ISO 8601 timestamp when the instance finished (completed or failed). */
  completedAt?: string;
  /** Top-level error message if the whole workflow failed. */
  error?: string;
}
