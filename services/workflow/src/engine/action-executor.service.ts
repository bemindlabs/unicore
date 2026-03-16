/**
 * ActionExecutorService — registry that routes actions to their executor.
 *
 * Executors are auto-registered on module init by scanning the injected list.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { WorkflowAction } from '../schema/workflow-definition.schema';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from '../executors/action-executor.interface';
import { CallAgentExecutor } from '../executors/call-agent.executor';
import { UpdateErpExecutor } from '../executors/update-erp.executor';
import { SendNotificationExecutor } from '../executors/send-notification.executor';
import { SendTelegramExecutor } from '../executors/send-telegram.executor';

@Injectable()
export class ActionExecutorService implements OnModuleInit {
  private readonly logger = new Logger(ActionExecutorService.name);
  private readonly registry = new Map<string, IActionExecutor>();

  constructor(
    private readonly callAgentExecutor: CallAgentExecutor,
    private readonly updateErpExecutor: UpdateErpExecutor,
    private readonly sendNotificationExecutor: SendNotificationExecutor,
    private readonly sendTelegramExecutor: SendTelegramExecutor,
  ) {}

  onModuleInit(): void {
    const executors: IActionExecutor[] = [
      this.callAgentExecutor,
      this.updateErpExecutor,
      this.sendNotificationExecutor,
      this.sendTelegramExecutor,
    ];

    for (const executor of executors) {
      this.registry.set(executor.actionType, executor);
      this.logger.log(`Registered executor for action type: ${executor.actionType}`);
    }
  }

  async execute(
    action: WorkflowAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const executor = this.registry.get(action.type);

    if (!executor) {
      const error = `No executor registered for action type: ${action.type}`;
      this.logger.error(error);
      return { success: false, error };
    }

    // Cast is safe: executor is keyed by action.type discriminant
    return executor.execute(action as never, context);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}
