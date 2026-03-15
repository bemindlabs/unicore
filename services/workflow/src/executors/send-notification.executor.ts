/**
 * SendNotificationExecutor — dispatches a notification through a channel.
 *
 * Channels supported in this stub: email, slack, line, webhook.
 * Production implementations delegate to the Comms service.
 */
import { Injectable, Logger } from "@nestjs/common";
import type { SendNotificationAction } from "../schema/workflow-definition.schema";
import { interpolate } from "../common/template-interpolator";
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from "./action-executor.interface";

@Injectable()
export class SendNotificationExecutor implements IActionExecutor<SendNotificationAction> {
  readonly actionType = "send_notification" as const;
  private readonly logger = new Logger(SendNotificationExecutor.name);

  async execute(
    action: SendNotificationAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const {
      channel,
      recipient: recipientTemplate,
      subject: subjectTemplate,
      bodyTemplate,
    } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const recipient = interpolate(recipientTemplate, interpolationCtx);
    const subject = interpolate(subjectTemplate, interpolationCtx);
    const body = interpolate(bodyTemplate, interpolationCtx);

    if (!recipient) {
      return { success: false, error: "Recipient resolved to empty string" };
    }

    this.logger.log(
      `[${context.instanceId}] Sending ${channel} notification to "${recipient}" — subject: "${subject}"`,
    );

    try {
      if (channel === "webhook") {
        const response = await fetch(recipient, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Webhook delivery to "${recipient}" failed with ${response.status}: ${errorText}`,
          );
        }
      } else {
        const integrationsUrl = process.env.INTEGRATIONS_SERVICE_URL;
        if (!integrationsUrl) {
          throw new Error(
            "INTEGRATIONS_SERVICE_URL environment variable is not set",
          );
        }

        const response = await fetch(
          `${integrationsUrl}/api/notifications/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel, recipient, subject, body }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Integrations service returned ${response.status} for ${channel} notification: ${errorText}`,
          );
        }
      }

      this.logger.log(
        `[${context.instanceId}] Notification sent via ${channel} to "${recipient}"`,
      );

      return {
        success: true,
        output: {
          channel,
          recipient,
          subject,
          bodyPreview: body.slice(0, 120),
        },
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
