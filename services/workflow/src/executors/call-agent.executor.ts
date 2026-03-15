/**
 * CallAgentExecutor — invokes a registered AI agent with an interpolated prompt.
 *
 * In production this will call the OpenClaw Gateway over HTTP/gRPC.
 * The stub here logs the request and returns a simulated reply so the
 * rest of the engine can be tested end-to-end without a live agent runtime.
 */
import { Injectable, Logger } from "@nestjs/common";
import type { CallAgentAction } from "../schema/workflow-definition.schema";
import { interpolate } from "../common/template-interpolator";
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from "./action-executor.interface";

@Injectable()
export class CallAgentExecutor implements IActionExecutor<CallAgentAction> {
  readonly actionType = "call_agent" as const;
  private readonly logger = new Logger(CallAgentExecutor.name);

  async execute(
    action: CallAgentAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const { agentName, promptTemplate, model } = action.config;

    // Build interpolation context: trigger payload + previous action outputs
    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const prompt = interpolate(promptTemplate, interpolationCtx);

    this.logger.log(
      `[${context.instanceId}] Calling agent "${agentName}"${model ? ` (model: ${model})` : ""}`,
    );
    this.logger.debug(`[${context.instanceId}] Prompt: ${prompt}`);

    try {
      const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
      if (!gatewayUrl) {
        throw new Error("OPENCLAW_GATEWAY_URL environment variable is not set");
      }

      const response = await fetch(
        `${gatewayUrl}/api/agents/${encodeURIComponent(agentName)}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, ...(model ? { model } : {}) }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenClaw Gateway returned ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as {
        reply?: string;
        [key: string]: unknown;
      };
      const reply = data.reply ?? JSON.stringify(data);

      this.logger.log(`[${context.instanceId}] Agent "${agentName}" completed`);

      return {
        success: true,
        output: { agentName, prompt, reply },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] Agent "${agentName}" failed: ${message}`,
      );
      return { success: false, error: message };
    }
  }
}
