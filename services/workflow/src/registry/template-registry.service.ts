import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import type {
  WorkflowDefinition,
  TriggerType,
  ActionType,
} from '../schema/workflow-definition.schema';
import { TemplateLoaderService } from '../loader/template-loader.service';

/** Result returned after validating a template definition. */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
}

/** All supported trigger type values for runtime validation. */
const VALID_TRIGGER_TYPES = new Set<TriggerType>([
  'erp.order.created',
  'erp.order.updated',
  'erp.order.fulfilled',
  'erp.inventory.low',
  'erp.inventory.restocked',
  'erp.invoice.created',
  'erp.invoice.overdue',
  'erp.invoice.paid',
  'schedule.cron',
  'webhook',
  'manual',
]);

/** All supported action type values for runtime validation. */
const VALID_ACTION_TYPES = new Set<ActionType>([
  'call_agent',
  'update_erp',
  'send_notification',
]);

/**
 * TemplateRegistryService is the central in-memory registry for pre-built
 * workflow template definitions.
 *
 * Responsibilities:
 * - Hydrate from TemplateLoaderService on startup.
 * - Validate each template before registration.
 * - Provide lookup by ID and by trigger type.
 * - Allow runtime registration of additional templates (e.g. from Pro packages).
 *
 * Registered definitions are consumed by WorkflowTemplateBootstrapService,
 * which loads them into the WorkflowEngineService at startup.
 */
@Injectable()
export class TemplateRegistryService implements OnModuleInit {
  private readonly logger = new Logger(TemplateRegistryService.name);

  /** Primary store: templateId → WorkflowDefinition */
  private readonly registry = new Map<string, WorkflowDefinition>();

  /** Secondary index: triggerType → templateId[] */
  private readonly byTrigger = new Map<TriggerType, string[]>();

  constructor(private readonly loader: TemplateLoaderService) {}

  onModuleInit(): void {
    const definitions = this.loader.getAll();

    for (const definition of definitions) {
      const { valid, errors } = this.validate(definition);

      if (!valid) {
        this.logger.warn(
          `Skipping invalid template "${definition.id}": ${errors.join('; ')}`,
        );
        continue;
      }

      this.registerInternal(definition);
    }

    this.logger.log(
      `Registry initialised with ${this.registry.size} valid pre-built template(s).`,
    );
  }

  // ---------------------------------------------------------------------------
  // Public read API
  // ---------------------------------------------------------------------------

  /**
   * Returns all registered definitions.
   * @param enabledOnly - When true (default), only enabled templates are returned.
   */
  findAll(enabledOnly = true): WorkflowDefinition[] {
    const all = Array.from(this.registry.values());
    return enabledOnly ? all.filter((t) => t.enabled) : all;
  }

  /**
   * Returns a definition by its unique ID.
   * @throws NotFoundException when the ID is unknown.
   */
  findById(id: string): WorkflowDefinition {
    const definition = this.registry.get(id);
    if (!definition) {
      throw new NotFoundException(`Workflow template "${id}" not found.`);
    }
    return definition;
  }

  /**
   * Returns all enabled templates whose trigger type matches the given value.
   * Returns [] when no templates match.
   */
  findByTrigger(triggerType: TriggerType): WorkflowDefinition[] {
    const ids = this.byTrigger.get(triggerType) ?? [];
    return ids
      .map((id) => this.registry.get(id))
      .filter((t): t is WorkflowDefinition => t !== undefined && t.enabled);
  }

  // ---------------------------------------------------------------------------
  // Public mutation API
  // ---------------------------------------------------------------------------

  /**
   * Registers a definition at runtime (e.g. from Pro extension packages).
   * Re-registration (same ID) replaces the existing entry.
   * @throws BadRequestException when validation fails.
   */
  register(definition: WorkflowDefinition): void {
    const { valid, errors } = this.validate(definition);
    if (!valid) {
      throw new BadRequestException(
        `Cannot register template "${definition.id}": ${errors.join('; ')}`,
      );
    }
    this.registerInternal(definition);
  }

  /**
   * Validates a definition and returns a structured result.
   * Does not throw — callers decide how to handle invalid templates.
   */
  validate(definition: WorkflowDefinition): TemplateValidationResult {
    const errors: string[] = [];

    if (!definition.id || typeof definition.id !== 'string' || !definition.id.trim()) {
      errors.push('`id` must be a non-empty string.');
    }

    if (!definition.name || typeof definition.name !== 'string' || !definition.name.trim()) {
      errors.push('`name` must be a non-empty string.');
    }

    if (typeof definition.schemaVersion !== 'number' || definition.schemaVersion < 1) {
      errors.push('`schemaVersion` must be a positive integer.');
    }

    if (!definition.trigger) {
      errors.push('`trigger` block is required.');
    } else {
      if (!VALID_TRIGGER_TYPES.has(definition.trigger.type)) {
        errors.push(
          `\`trigger.type\` "${definition.trigger.type}" is not recognised. Valid values: ${[...VALID_TRIGGER_TYPES].join(', ')}.`,
        );
      }
      if (definition.trigger.type === 'schedule.cron' && !definition.trigger.cron) {
        errors.push('`trigger.cron` is required when trigger.type is "schedule.cron".');
      }
    }

    if (!Array.isArray(definition.actions) || definition.actions.length === 0) {
      errors.push('`actions` must be a non-empty array.');
    } else {
      errors.push(...this.validateActions(definition.actions));
    }

    return { valid: errors.length === 0, errors };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private registerInternal(definition: WorkflowDefinition): void {
    if (this.registry.has(definition.id)) {
      this.removeTriggerIndex(definition.id);
    }

    this.registry.set(definition.id, definition);
    this.addTriggerIndex(definition.id, definition.trigger.type);

    this.logger.debug(
      `Registered template "${definition.id}" (trigger: ${definition.trigger.type})`,
    );
  }

  private validateActions(actions: WorkflowDefinition['actions']): string[] {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    for (const action of actions) {
      const prefix = `action[${action.id ?? '?'}]`;

      if (!action.id || typeof action.id !== 'string') {
        errors.push(`${prefix}: \`id\` must be a non-empty string.`);
      } else if (seenIds.has(action.id)) {
        errors.push(`Duplicate action id "${action.id}".`);
      } else {
        seenIds.add(action.id);
      }

      if (!action.label || typeof action.label !== 'string') {
        errors.push(`${prefix}: \`label\` must be a non-empty string.`);
      }

      if (!VALID_ACTION_TYPES.has(action.type)) {
        errors.push(
          `${prefix}: \`type\` "${action.type}" is not a recognised action type.`,
        );
      }

      for (const dep of action.dependsOn ?? []) {
        if (!actions.some((a) => a.id === dep)) {
          errors.push(
            `${prefix}: \`dependsOn\` references unknown action id "${dep}".`,
          );
        }
      }
    }

    return errors;
  }

  private addTriggerIndex(templateId: string, triggerType: TriggerType): void {
    const existing = this.byTrigger.get(triggerType) ?? [];
    this.byTrigger.set(triggerType, [...existing, templateId]);
  }

  private removeTriggerIndex(templateId: string): void {
    for (const [trigger, ids] of this.byTrigger.entries()) {
      this.byTrigger.set(
        trigger,
        ids.filter((id) => id !== templateId),
      );
    }
  }
}
