/**
 * WorkflowEngine — core execution service.
 *
 * Responsibilities:
 *  1. Load workflow definitions from the registry.
 *  2. Evaluate trigger conditions against an incoming event payload.
 *  3. Create a WorkflowInstance and persist it via WorkflowStateStore.
 *  4. Execute action steps in dependency order (serial topological walk).
 *  5. Update instance state at each step transition.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { WorkflowDefinition, WorkflowAction } from '../schema/workflow-definition.schema';
import { evaluateConditions } from '../common/condition-evaluator';
import { WorkflowStateStore } from '../state/workflow-state.store';
import type { WorkflowInstance, ActionExecution } from '../state/workflow-instance';
import { ActionExecutorService } from './action-executor.service';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  /** In-memory definition registry. Replace with DB-backed store in production. */
  private readonly definitions = new Map<string, WorkflowDefinition>();

  constructor(
    private readonly stateStore: WorkflowStateStore,
    private readonly executorService: ActionExecutorService,
  ) {}

  // -------------------------------------------------------------------------
  // Definition Management
  // -------------------------------------------------------------------------

  registerDefinition(definition: WorkflowDefinition): void {
    this.definitions.set(definition.id, definition);
    this.logger.log(`Registered workflow definition: "${definition.name}" (${definition.id})`);
  }

  getDefinition(workflowId: string): WorkflowDefinition {
    const def = this.definitions.get(workflowId);
    if (!def) {
      throw new NotFoundException(`Workflow definition not found: ${workflowId}`);
    }
    return def;
  }

  listDefinitions(): WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  removeDefinition(workflowId: string): boolean {
    return this.definitions.delete(workflowId);
  }

  // -------------------------------------------------------------------------
  // Trigger evaluation
  // -------------------------------------------------------------------------

  /**
   * Returns all enabled definitions whose trigger type matches `eventType`
   * and whose conditions are satisfied by `payload`.
   */
  matchingDefinitions(
    eventType: string,
    payload: unknown,
  ): WorkflowDefinition[] {
    return Array.from(this.definitions.values()).filter(
      (def) =>
        def.enabled &&
        def.trigger.type === eventType &&
        evaluateConditions(def.trigger.conditions, payload),
    );
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Triggers a workflow by definition ID.
   * Creates and persists a new WorkflowInstance, then runs actions async.
   */
  async trigger(
    workflowId: string,
    triggerPayload: unknown,
  ): Promise<WorkflowInstance> {
    const definition = this.getDefinition(workflowId);

    if (!definition.enabled) {
      throw new Error(`Workflow "${definition.name}" is disabled`);
    }

    const now = new Date().toISOString();
    const instance: WorkflowInstance = {
      instanceId: uuidv4(),
      workflowId: definition.id,
      workflowName: definition.name,
      status: 'pending',
      triggerPayload,
      actions: definition.actions.map((a) => ({
        actionId: a.id,
        actionType: a.type,
        label: a.label,
        status: 'pending',
      })),
      createdAt: now,
      updatedAt: now,
    };

    this.stateStore.save(instance);
    this.logger.log(
      `Created instance ${instance.instanceId} for workflow "${definition.name}"`,
    );

    // Execute asynchronously so the caller gets the instance immediately.
    void this.runInstance(instance, definition);

    return instance;
  }

  /**
   * Handles an incoming event: evaluates all matching definitions and
   * triggers each one.  Returns the spawned instances.
   */
  async handleEvent(
    eventType: string,
    payload: unknown,
  ): Promise<WorkflowInstance[]> {
    const matched = this.matchingDefinitions(eventType, payload);

    if (matched.length === 0) {
      this.logger.debug(`No workflows matched event type: ${eventType}`);
      return [];
    }

    this.logger.log(
      `Event "${eventType}" matched ${matched.length} workflow(s)`,
    );

    const instances = await Promise.all(
      matched.map((def) => this.trigger(def.id, payload)),
    );

    return instances;
  }

  // -------------------------------------------------------------------------
  // Internal execution loop
  // -------------------------------------------------------------------------

  private async runInstance(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
  ): Promise<void> {
    // Transition to running
    this.updateInstance(instance, { status: 'running' });

    let orderedActions: WorkflowAction[];
    try {
      // Execute actions in topological order (serial walk respecting dependsOn)
      orderedActions = this.topologicalSort(definition.actions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateInstance(instance, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: message,
      });
      this.logger.error(
        `[${instance.instanceId}] Workflow "${instance.workflowName}" FAILED: ${message}`,
      );
      return;
    }

    const previousOutputs: Record<string, unknown> = {};

    for (const action of orderedActions) {
      // Check if all dependencies succeeded
      const deps = action.dependsOn ?? [];
      const depsFailed = deps.some((depId) => {
        const depExec = instance.actions.find((ae) => ae.actionId === depId);
        return depExec?.status === 'failed';
      });

      if (depsFailed) {
        this.updateActionStatus(instance, action.id, 'skipped');
        this.logger.warn(
          `[${instance.instanceId}] Skipping action "${action.label}" — dependency failed`,
        );
        continue;
      }

      // Mark action as running
      this.updateActionStatus(instance, action.id, 'running', {
        startedAt: new Date().toISOString(),
      });

      // Apply per-action timeout
      const timeoutMs = action.timeoutMs ?? 30_000;
      let result: Awaited<ReturnType<ActionExecutorService['execute']>>;

      try {
        result = await Promise.race([
          this.executorService.execute(action, {
            triggerPayload: instance.triggerPayload,
            previousOutputs,
            instanceId: instance.instanceId,
            workflowName: instance.workflowName,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Action "${action.label}" timed out after ${timeoutMs}ms`)),
              timeoutMs,
            ),
          ),
        ]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result = { success: false, error: message };
      }

      const completedAt = new Date().toISOString();

      if (result.success) {
        previousOutputs[action.id] = result.output;
        this.updateActionStatus(instance, action.id, 'completed', {
          completedAt,
          output: result.output,
        });
      } else {
        this.updateActionStatus(instance, action.id, 'failed', {
          completedAt,
          error: result.error,
        });

        if (!action.continueOnError) {
          this.updateInstance(instance, {
            status: 'failed',
            completedAt,
            error: `Action "${action.label}" failed: ${result.error}`,
          });
          this.logger.error(
            `[${instance.instanceId}] Workflow "${instance.workflowName}" FAILED at action "${action.label}": ${result.error}`,
          );
          return;
        }

        this.logger.warn(
          `[${instance.instanceId}] Action "${action.label}" failed (continueOnError=true), continuing`,
        );
      }
    }

    const completedAt = new Date().toISOString();
    this.updateInstance(instance, { status: 'completed', completedAt });
    this.logger.log(
      `[${instance.instanceId}] Workflow "${instance.workflowName}" COMPLETED`,
    );
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private updateInstance(
    instance: WorkflowInstance,
    patch: Partial<WorkflowInstance>,
  ): void {
    Object.assign(instance, patch, { updatedAt: new Date().toISOString() });
    this.stateStore.save(instance);
  }

  private updateActionStatus(
    instance: WorkflowInstance,
    actionId: string,
    status: ActionExecution['status'],
    extra: Partial<ActionExecution> = {},
  ): void {
    const exec = instance.actions.find((a) => a.actionId === actionId);
    if (exec) {
      Object.assign(exec, { status, ...extra });
      this.stateStore.save(instance);
    }
  }

  /**
   * Kahn's algorithm — returns actions sorted so that every action appears
   * after all its dependencies.  Detects cycles and throws.
   */
  private topologicalSort(actions: WorkflowAction[]): WorkflowAction[] {
    const inDegree = new Map<string, number>(actions.map((a) => [a.id, 0]));
    const adjacency = new Map<string, string[]>(actions.map((a) => [a.id, []]));

    for (const action of actions) {
      for (const dep of action.dependsOn ?? []) {
        adjacency.get(dep)?.push(action.id);
        inDegree.set(action.id, (inDegree.get(action.id) ?? 0) + 1);
      }
    }

    const queue = actions.filter((a) => (inDegree.get(a.id) ?? 0) === 0);
    const result: WorkflowAction[] = [];
    const actionById = new Map<string, WorkflowAction>(actions.map((a) => [a.id, a]));

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current.id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(actionById.get(neighbor)!);
        }
      }
    }

    if (result.length !== actions.length) {
      throw new Error('Workflow actions contain a dependency cycle');
    }

    return result;
  }
}
