/**
 * Extended metadata attached to pre-built workflow templates.
 * This supplements WorkflowDefinition (from the schema) with UI-facing
 * information used in the template picker and bootstrap wizard.
 */

/** Category tag for grouping templates in the UI. */
export type TemplateCategory = 'finance' | 'inventory' | 'operations' | 'communications';

/** Metadata block stored alongside each pre-built template definition. */
export interface WorkflowTemplateMeta {
  /** UI category for grouping. */
  category: TemplateCategory;
  /** Agent names invoked by this template (for capability display). */
  agents: string[];
  /** ERP module IDs required for this template to function. */
  requiredModules: string[];
  /** Rough end-to-end execution time in seconds (shown in the UI). */
  estimatedDurationSec: number;
}

/**
 * A pre-built workflow template as stored on disk.
 * Extends the core WorkflowDefinition fields with a `meta` block.
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
  };
  actions: unknown[];
  meta: WorkflowTemplateMeta;
}
