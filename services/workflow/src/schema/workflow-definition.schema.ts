/**
 * Workflow Definition Schema
 *
 * Describes a complete workflow: trigger conditions -> ordered action steps.
 * Stored as JSON in the database; validated at load time.
 */

// ---------------------------------------------------------------------------
// Trigger Types
// ---------------------------------------------------------------------------

/** Supported trigger event sources. */
export type TriggerType =
  | 'erp.order.created'
  | 'erp.order.updated'
  | 'erp.order.fulfilled'
  | 'erp.inventory.low'
  | 'erp.inventory.restocked'
  | 'erp.invoice.created'
  | 'erp.invoice.overdue'
  | 'erp.invoice.paid'
  | 'schedule.cron'
  | 'webhook'
  | 'manual';

/** Comparison operators for trigger condition evaluation. */
export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists';

/** A single condition applied to the trigger event payload. */
export interface TriggerCondition {
  /** JSON path into the event payload (e.g. "payload.amount"). */
  field: string;
  operator: ConditionOperator;
  /** Expected value — omitted for exists / not_exists operators. */
  value?: string | number | boolean;
}

/** Trigger block of a workflow definition. */
export interface WorkflowTrigger {
  type: TriggerType;
  /** All conditions must be satisfied for the workflow to fire. */
  conditions?: TriggerCondition[];
  /** Cron expression — required when type === 'schedule.cron'. */
  cron?: string;
  /** Webhook secret token — required when type === 'webhook'. */
  webhookSecret?: string;
}

// ---------------------------------------------------------------------------
// Action Types
// ---------------------------------------------------------------------------

/** Discriminated union tag for action executors. */
export type ActionType = 'call_agent' | 'update_erp' | 'send_notification' | 'send_telegram';

/** Base fields shared by every action step. */
export interface BaseAction {
  /** Unique ID within the workflow (used for dependency references). */
  id: string;
  type: ActionType;
  /** Human-readable label shown in the UI. */
  label: string;
  /**
   * IDs of actions that must complete before this one starts.
   * Empty array (default) means "run as soon as the previous step finishes".
   */
  dependsOn?: string[];
  /**
   * When true, a failure in this action does NOT abort the workflow.
   * Defaults to false.
   */
  continueOnError?: boolean;
  /** Timeout in milliseconds for this action. Defaults to 30 000. */
  timeoutMs?: number;
}

/** Calls an AI agent by name and passes a rendered prompt. */
export interface CallAgentAction extends BaseAction {
  type: 'call_agent';
  config: {
    /** Registered agent name (e.g. "ops-agent", "growth-agent"). */
    agentName: string;
    /**
     * Prompt template — supports `{{field}}` interpolation against the
     * trigger event payload and previous action outputs.
     */
    promptTemplate: string;
    /** Agent model override (optional). */
    model?: string;
  };
}

/** Applies a mutation to an ERP entity. */
export interface UpdateErpAction extends BaseAction {
  type: 'update_erp';
  config: {
    /** ERP entity type to mutate. */
    entity: 'order' | 'invoice' | 'inventory' | 'contact';
    /** Entity ID — supports `{{field}}` interpolation. */
    entityId: string;
    /** Key-value pairs to update. Values support `{{field}}` interpolation. */
    fields: Record<string, string | number | boolean>;
  };
}

/** Dispatches a notification through a configured channel. */
export interface SendNotificationAction extends BaseAction {
  type: 'send_notification';
  config: {
    channel: 'email' | 'slack' | 'line' | 'webhook';
    /** Recipient address/ID — supports `{{field}}` interpolation. */
    recipient: string;
    /** Subject or title — supports `{{field}}` interpolation. */
    subject: string;
    /** Body template — supports `{{field}}` interpolation. */
    bodyTemplate: string;
  };
}

/** Sends a message to a Telegram chat via the Bot API. */
export interface SendTelegramAction extends BaseAction {
  type: 'send_telegram';
  config: {
    /** Telegram chat ID — supports `{{field}}` interpolation. */
    chatId: string;
    /** Direct message text — supports `{{field}}` interpolation. */
    message?: string;
    /** Message template (alternative to message) — supports `{{field}}` interpolation. */
    template?: string;
    /** Telegram parse mode. Defaults to 'HTML'. */
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  };
}

export type WorkflowAction =
  | CallAgentAction
  | UpdateErpAction
  | SendNotificationAction
  | SendTelegramAction;

// ---------------------------------------------------------------------------
// Top-level Workflow Definition
// ---------------------------------------------------------------------------

/** Schema version — increment on breaking changes. */
export const WORKFLOW_SCHEMA_VERSION = 1;

/**
 * A fully-specified, serialisable workflow definition.
 * This is what is persisted to the database and loaded by WorkflowEngine.
 */
export interface WorkflowDefinition {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Display name. */
  name: string;
  /** Optional description shown in the UI. */
  description?: string;
  /** Whether this workflow will fire when triggered. */
  enabled: boolean;
  schemaVersion: number;
  trigger: WorkflowTrigger;
  /** Ordered list of action steps. Execution follows dependsOn graph. */
  actions: WorkflowAction[];
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}
