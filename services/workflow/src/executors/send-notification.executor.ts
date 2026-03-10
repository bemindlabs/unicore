/**
 * SendNotificationExecutor — dispatches a notification through a channel.
 *
 * Channels supported in this stub: email, slack, line, webhook.
 * Production implementations delegate to the Comms service.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { SendNotificationAction } from '../schema/workflow-definition.schema';
import { interpolate } from '../common/template-interpolator';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from './action-executor.interface';

@Injectable()
export class SendNotificationExecutor
  implements IActionExecutor<SendNotificationAction>
{
  readonly actionType = 'send_notification' as const;
  private readonly logger = new Logger(SendNotificationExecutor.name);

  async execute(
    action: SendNotificationAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const { channel, recipient: recipientTemplate, subject: subjectTemplate, bodyTemplate } =
      action.config;

    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const recipient = interpolate(recipientTemplate, interpolationCtx);
    const subject = interpolate(subjectTemplate, interpolationCtx);
    const body = interpolate(bodyTemplate, interpolationCtx);

    if (!recipient) {
      return { success: false, error: 'Recipient resolved to empty string' };
    }

    this.logger.log(
      `[${context.instanceId}] Sending ${channel} notification to "${recipient}" — subject: "${subject}"`,
    );

    try {
      // TODO: delegate to Comms service via Kafka or HTTP.
      // await this.commsClient.send({ channel, recipient, subject, body });

      this.logger.log(
        `[${context.instanceId}] Notification sent via ${channel} to "${recipient}"`,
      );

      return {
        success: true,
        output: { channel, recipient, subject, bodyPreview: body.slice(0, 120) },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] Notification failed (${channel} → ${recipient}): ${message}`,
      );
      return { success: false, error: message };
    }
  }
}
