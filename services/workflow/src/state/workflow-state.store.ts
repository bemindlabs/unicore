/**
 * WorkflowStateStore — in-memory store for workflow instances.
 *
 * Production replacement: swap this for a Prisma-backed store that persists
 * rows to PostgreSQL 16. The interface is kept narrow so the swap is trivial.
 */
import { Injectable, Logger } from '@nestjs/common';
import { WorkflowInstance, WorkflowStatus } from './workflow-instance';

@Injectable()
export class WorkflowStateStore {
  private readonly logger = new Logger(WorkflowStateStore.name);
  private readonly store = new Map<string, WorkflowInstance>();

  save(instance: WorkflowInstance): void {
    this.store.set(instance.instanceId, { ...instance });
    this.logger.debug(
      `Saved instance ${instance.instanceId} [${instance.status}]`,
    );
  }

  findById(instanceId: string): WorkflowInstance | undefined {
    const inst = this.store.get(instanceId);
    return inst ? { ...inst } : undefined;
  }

  findByWorkflowId(workflowId: string): WorkflowInstance[] {
    return Array.from(this.store.values())
      .filter((i) => i.workflowId === workflowId)
      .map((i) => ({ ...i }));
  }

  findByStatus(status: WorkflowStatus): WorkflowInstance[] {
    return Array.from(this.store.values())
      .filter((i) => i.status === status)
      .map((i) => ({ ...i }));
  }

  findAll(): WorkflowInstance[] {
    return Array.from(this.store.values()).map((i) => ({ ...i }));
  }

  delete(instanceId: string): boolean {
    return this.store.delete(instanceId);
  }

  /** Returns the total number of stored instances. Useful for health checks. */
  count(): number {
    return this.store.size;
  }
}
