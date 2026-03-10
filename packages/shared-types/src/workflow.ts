// Workflow Types

export type WorkflowTrigger =
  | { type: 'event'; event: string }
  | { type: 'schedule'; cron: string }
  | { type: 'manual' }
  | { type: 'webhook'; path: string };

export interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: WorkflowAction;
  condition?: string;
  onSuccess?: string;
  onFailure?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}
