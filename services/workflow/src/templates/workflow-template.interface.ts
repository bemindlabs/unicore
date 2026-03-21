/**
 * Extended metadata attached to pre-built workflow templates.
 * This supplements WorkflowDefinition (from the schema) with UI-facing
 * information used in the template picker and bootstrap wizard.
 */

/** Category tag for grouping templates in the UI. */
export type TemplateCategory =
  | 'finance'
  | 'inventory'
  | 'operations'
  | 'communications'
  | 'sales'
  | 'hr'
  | 'support';

/** Variable declaration inside a template — filled in at install time. */
export interface TemplateVariable {
  /** Unique key used in `{{var:key}}` tokens within action configs. */
  key: string;
  /** Human-readable label shown in the install wizard. */
  label: string;
  /** Optional help text shown beneath the input field. */
  description?: string;
  /** Data type — controls the input widget rendered in the UI. */
  type: 'string' | 'number' | 'boolean' | 'email' | 'url';
  /** Whether the user must provide this variable before installing. */
  required: boolean;
  /** Value pre-filled in the install wizard. */
  defaultValue?: string | number | boolean;
  /** Placeholder text for the input field. */
  placeholder?: string;
}

/** An external integration required for a template to function. */
export interface RequiredIntegration {
  /** Integration identifier (e.g. "slack", "telegram", "line", "email"). */
  id: string;
  /** Human-readable name. */
  label: string;
  /** What the integration is used for in this template. */
  description?: string;
  /** When false the template still works but this integration is skipped. */
  required: boolean;
}

/** Metadata block stored alongside each pre-built template definition. */
export interface WorkflowTemplateMeta {
  /** UI category for grouping. */
  category: TemplateCategory;
  /** Agent names invoked by this template (for capability display). */
  agents: string[];
  /** ERP module IDs required for this template to function. */
  requiredModules: string[];
  /** External integrations needed (e.g. Slack, Telegram). */
  requiredIntegrations: RequiredIntegration[];
  /** Searchable tags for the gallery. */
  tags: string[];
  /** Rough end-to-end execution time in seconds (shown in the UI). */
  estimatedDurationSec: number;
  /** Template author name or team. */
  author?: string;
  /** Semantic version of this plugin template. */
  version?: string;
}

/**
 * A pre-built workflow template as stored on disk.
 * Extends the core WorkflowDefinition fields with a `meta` block and
 * optional `variables` for parameterised install.
 *
 * The `id` field is derived from the filename at load time so it is
 * intentionally omitted from the on-disk JSON.
 */
export interface WorkflowTemplateFile {
  name: string;
  description?: string;
  enabled: boolean;
  schemaVersion: number;
  trigger: {
    type: string;
    conditions?: unknown[];
    cron?: string;
    webhookSecret?: string;
  };
  actions: unknown[];
  /** Template variables declared for parameterised install. */
  variables?: TemplateVariable[];
  meta: WorkflowTemplateMeta;
}

/**
 * Full gallery item — the shape returned by the gallery API.
 * Combines the WorkflowDefinition core fields with rich plugin metadata.
 */
export interface WorkflowTemplatePlugin {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schemaVersion: number;
  trigger: {
    type: string;
    conditions?: unknown[];
    cron?: string;
  };
  /** Declared variables for parameterised install. */
  variables: TemplateVariable[];
  meta: WorkflowTemplateMeta;
}
