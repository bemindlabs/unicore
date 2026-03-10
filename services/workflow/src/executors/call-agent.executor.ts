/**
 * CallAgentExecutor — invokes a registered AI agent with an interpolated prompt.
 *
 * The trigger payload is spread at the root of the interpolation context so
 * template authors write {{payload.orderId}} when the trigger event shape is
 * { payload: { orderId: ... } }.  Previous action outputs are accessible via
 * {{outputs.<actionId>.<field>}}.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { CallAgentAction } from '../schema/workflow-definition.schema';
import { interpolate } from '../common/template-interpolator';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from './action-executor.interface';

@Injectable()
export class CallAgentExecutor implements IActionExecutor<CallAgentAction> {
  readonly actionType = 'call_agent' as const;
  private readonly logger = new Logger(CallAgentExecutor.name);

  async execute(
    action: CallAgentAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const { agentName, promptTemplate, model } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      ...(typeof context.triggerPayload === 'object' && context.triggerPayload !== null
        ? (context.triggerPayload as Record<string, unknown>)
        : {}),
      outputs: context.previousOutputs,
    };

    const prompt = interpolate(promptTemplate, interpolationCtx);

    this.logger.log(
      `[${context.instanceId}] Calling agent "${agentName}"${model ? ` (model: ${model})` : ''}`,
    );
    this.logger.debug(`[${context.instanceId}] Prompt: ${prompt}`);

    try {
      // TODO: replace stub with actual OpenClaw Gateway HTTP call.
      const stubReply = `[STUB] Agent "${agentName}" processed: ${prompt.slice(0, 80)}`;
      this.logger.log(`[${context.instanceId}] Agent "${agentName}" completed`);
      return { success: true, output: { agentName, prompt, reply: stubReply } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${context.instanceId}] Agent "${agentName}" failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
