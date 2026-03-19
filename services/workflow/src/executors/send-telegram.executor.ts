/**
 * SendTelegramExecutor — sends a message to a Telegram chat via the Bot API.
 *
 * The bot token must be configured via dashboard Settings → Channels.
 * Action config requires a chatId and either a message or a template
 * (which supports {{field}} interpolation).
 */
import { Injectable, Logger } from '@nestjs/common';
import { interpolate } from '../common/template-interpolator';
import type {
  IActionExecutor,
  ActionExecutionContext,
  ActionExecutionResult,
} from './action-executor.interface';
import type { SendTelegramAction } from '../schema/workflow-definition.schema';

@Injectable()
export class SendTelegramExecutor implements IActionExecutor<SendTelegramAction> {
  readonly actionType = 'send_telegram' as const;
  private readonly logger = new Logger(SendTelegramExecutor.name);

  async execute(
    action: SendTelegramAction,
    context: ActionExecutionContext,
  ): Promise<ActionExecutionResult> {
    const botToken = action.config.botToken;

    if (!botToken) {
      return {
        success: false,
        error: 'Telegram bot token is not configured. Please set it via dashboard Settings → Channels.',
      };
    }

    const { chatId, message, template, parseMode } = action.config;

    const interpolationCtx: Record<string, unknown> = {
      payload: context.triggerPayload,
      outputs: context.previousOutputs,
    };

    const resolvedChatId = interpolate(chatId, interpolationCtx);
    const resolvedMessage = template
      ? interpolate(template, interpolationCtx)
      : message
        ? interpolate(message, interpolationCtx)
        : '';

    if (!resolvedChatId) {
      return { success: false, error: 'Chat ID resolved to empty string' };
    }

    if (!resolvedMessage) {
      return { success: false, error: 'Message resolved to empty string' };
    }

    this.logger.log(
      `[${context.instanceId}] Sending Telegram message to chat "${resolvedChatId}"`,
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: resolvedChatId,
            text: resolvedMessage,
            parse_mode: parseMode ?? 'HTML',
          }),
        },
      );

      const data: any = await response.json();

      if (!data.ok) {
        throw new Error(
          data.description ?? `Telegram API returned error code ${data.error_code}`,
        );
      }

      this.logger.log(
        `[${context.instanceId}] Telegram message sent to chat "${resolvedChatId}" (message_id: ${data.result.message_id})`,
      );

      return {
        success: true,
        output: {
          chatId: resolvedChatId,
          messageId: data.result.message_id,
          messagePreview: resolvedMessage.slice(0, 120),
        },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${context.instanceId}] Telegram send failed (chat ${resolvedChatId}): ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }
}
