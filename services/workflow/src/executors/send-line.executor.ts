/**
 * SendLineExecutor — sends a push message to a LINE user via the Messaging API.
 *
 * The channel access token must be configured via dashboard Settings → Channels.
 * Action config requires a `to` (user/group ID) and either a `message` or `template`
 * (which supports {{field}} interpolation).
 */
import { Injectable, Logger } from '@nestjs/common';
import { interpolate } from '../common/template-interpolator';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from './action-executor.interface';
import type { SendLineAction } from '../schema/workflow-definition.schema';

@Injectable()
export class SendLineExecutor implements IActionExecutor<SendLineAction> {
  readonly actionType = 'send_line' as const;
  private readonly logger = new Logger(SendLineExecutor.name);

  async execute(
    action: SendLineAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const accessToken = action.config.accessToken;

    if (!accessToken) {
      return {
        success: false,
        error: 'LINE channel access token is not configured. Please set it via dashboard Settings → Channels.',
      };
    }

    const { to, message, template } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const resolvedTo = interpolate(to, interpolationCtx);
    const resolvedMessage = template
      ? interpolate(template, interpolationCtx)
      : message
        ? interpolate(message, interpolationCtx)
        : '';

    if (!resolvedTo) {
      return { success: false, error: 'Recipient ID resolved to empty string' };
    }

    if (!resolvedMessage) {
      return { success: false, error: 'Message resolved to empty string' };
    }

    this.logger.log(
      `[${context.instanceId}] Sending LINE message to "${resolvedTo}"`,
    );

    try {
      const response = await fetch(
        'https://api.line.me/v2/bot/message/push',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: resolvedTo,
            messages: [{ type: 'text', text: resolvedMessage }],
          }),
        },
      );

      if (!response.ok) {
        const data: any = await response.json().catch(() => ({}));
        throw new Error(
          data.message ?? `LINE API returned status ${response.status}`,
        );
      }

      this.logger.log(
        `[${context.instanceId}] LINE message sent to "${resolvedTo}"`,
      );

      return {
        success: true,
        output: {
          to: resolvedTo,
          messagePreview: resolvedMessage.slice(0, 120),
        },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] LINE send failed (to ${resolvedTo}): ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }
}
