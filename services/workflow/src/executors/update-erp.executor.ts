/**
 * UpdateErpExecutor — applies field mutations to an ERP entity.
 *
 * In production this publishes an ERP command event to Kafka (or calls the
 * ERP service REST API). The stub validates input and logs the mutation.
 */
import { Injectable, Logger } from "@nestjs/common";
import type { UpdateErpAction } from "../schema/workflow-definition.schema";
import { interpolate } from "../common/template-interpolator";
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from "./action-executor.interface";

@Injectable()
export class UpdateErpExecutor implements IActionExecutor<UpdateErpAction> {
  readonly actionType = "update_erp" as const;
  private readonly logger = new Logger(UpdateErpExecutor.name);

  async execute(
    action: UpdateErpAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const { entity, entityId: entityIdTemplate, fields } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const entityId = interpolate(entityIdTemplate, interpolationCtx);

    // Interpolate each field value that is a string template
    const resolvedFields: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(fields)) {
      resolvedFields[key] =
        typeof value === "string"
          ? interpolate(value, interpolationCtx)
          : value;
    }

    if (!entityId) {
      return {
        success: false,
        error: `Could not resolve entityId for ${entity}`,
      };
    }

    this.logger.log(
      `[${context.instanceId}] Updating ERP ${entity}:${entityId} — fields: ${JSON.stringify(resolvedFields)}`,
    );

    try {
      const erpUrl = process.env.ERP_SERVICE_URL;
      if (!erpUrl) {
        throw new Error("ERP_SERVICE_URL environment variable is not set");
      }

      const response = await fetch(
        `${erpUrl}/api/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resolvedFields),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `ERP service returned ${response.status} for ${entity}:${entityId}: ${errorText}`,
        );
      }

      this.logger.log(
        `[${context.instanceId}] ERP ${entity}:${entityId} updated successfully`,
      );

      return {
        success: true,
        output: { entity, entityId, updatedFields: resolvedFields },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] ERP update failed for ${entity}:${entityId}: ${message}`,
      );
      return { success: false, error: message };
    }
  }
}
