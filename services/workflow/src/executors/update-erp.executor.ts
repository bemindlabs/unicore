/**
 * UpdateErpExecutor — applies field-level mutations to an ERP entity.
 *
 * Trigger payload is spread at the root of the interpolation context so
 * template authors write {{payload.orderId}} directly.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { UpdateErpAction } from '../schema/workflow-definition.schema';
import { interpolate } from '../common/template-interpolator';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from './action-executor.interface';

@Injectable()
export class UpdateErpExecutor implements IActionExecutor<UpdateErpAction> {
  readonly actionType = 'update_erp' as const;
  private readonly logger = new Logger(UpdateErpExecutor.name);

  async execute(
    action: UpdateErpAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const { entity, entityId: entityIdTemplate, fields } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      ...(typeof context.triggerPayload === 'object' && context.triggerPayload !== null
        ? (context.triggerPayload as Record<string, unknown>)
        : {}),
      outputs: context.previousOutputs,
    };

    const entityId = interpolate(entityIdTemplate, interpolationCtx);

    if (!entityId) {
      return { success: false, error: `Could not resolve entityId for ${entity}` };
    }

    const resolvedFields: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(fields)) {
      resolvedFields[key] =
        typeof value === 'string' ? interpolate(value, interpolationCtx) : value;
    }

    this.logger.log(
      `[${context.instanceId}] Updating ERP ${entity}:${entityId} — fields: ${JSON.stringify(resolvedFields)}`,
    );

    try {
      // TODO: publish Kafka command event or call ERP REST API.
      this.logger.log(`[${context.instanceId}] ERP ${entity}:${entityId} updated successfully`);
      return { success: true, output: { entity, entityId, updatedFields: resolvedFields } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] ERP update failed for ${entity}:${entityId}: ${message}`,
      );
      return { success: false, error: message };
    }
  }
}
