import { Injectable, Logger } from '@nestjs/common';
import { v4 as randomUUID } from 'uuid';
import { DlqService } from '../dlq/dlq.service';
import { getDlqTopic } from '../constants/kafka.constants';
import { EventHandlerService } from '../event-handler.service';

export interface RetryContext {
  /** Source Kafka topic the message was consumed from. */
  topic: string;
  /** eventId from the event envelope (used for correlation). */
  eventId: string;
  /** Original deserialized payload (stored in DLQ entry for replay). */
  originalPayload: unknown;
  /** Override default max retry count (default: KAFKA_APP_RETRY_MAX or 3). */
  maxRetries?: number;
  /** Override default base delay in ms (default: KAFKA_APP_RETRY_BASE_DELAY_MS or 1000). */
  baseDelayMs?: number;
}

export interface RetryResult {
  /** Number of retry attempts made (0 = succeeded on first try). */
  retryCount: number;
  /** true if the handler eventually succeeded, false if routed to DLQ. */
  succeeded: boolean;
}

/**
 * RetryService wraps Kafka consumer handlers with exponential-backoff retry
 * and automatic Dead Letter Queue (DLQ) routing on final failure.
 *
 * Retry schedule (default 3 retries, 1 s base):
 *   Attempt 1 failure → wait 1 s
 *   Attempt 2 failure → wait 2 s
 *   Attempt 3 failure → wait 4 s
 *   All retries exhausted → publish to DLQ, return { succeeded: false }
 *
 * Env vars:
 *   KAFKA_APP_RETRY_MAX          — max retry attempts (default: 3)
 *   KAFKA_APP_RETRY_BASE_DELAY_MS — base backoff delay in ms (default: 1000)
 */
@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);
  private readonly defaultMaxRetries: number;
  private readonly defaultBaseDelayMs: number;

  constructor(
    private readonly dlqService: DlqService,
    private readonly eventHandlerService: EventHandlerService,
  ) {
    this.defaultMaxRetries = Number(process.env['KAFKA_APP_RETRY_MAX'] ?? 3);
    this.defaultBaseDelayMs = Number(process.env['KAFKA_APP_RETRY_BASE_DELAY_MS'] ?? 1000);
  }

  /**
   * Executes `fn` with exponential-backoff retries.
   *
   * - On each failure, logs the retry attempt via EventHandlerService and waits
   *   `baseDelayMs * 2^(attempt-1)` before the next try.
   * - After exhausting all retries, publishes a DLQ entry and returns
   *   `{ succeeded: false, retryCount: maxRetries }`.
   * - Never throws — errors are handled internally.
   */
  async withRetry(fn: () => Promise<void>, context: RetryContext): Promise<RetryResult> {
    const maxRetries = context.maxRetries ?? this.defaultMaxRetries;
    const baseDelayMs = context.baseDelayMs ?? this.defaultBaseDelayMs;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < maxRetries) {
      try {
        await fn();
        return { retryCount: attempt, succeeded: true };
      } catch (err) {
        attempt++;
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            `[Retry ${attempt}/${maxRetries}] topic=${context.topic} eventId=${context.eventId} nextDelay=${delayMs}ms error=${lastError.message}`,
          );
          this.eventHandlerService.recordRetryAttempt(
            context.topic,
            context.eventId,
            attempt,
            maxRetries,
          );
          await this.sleep(delayMs);
        }
      }
    }

    // All retries exhausted — route to DLQ
    const dlqTopic = getDlqTopic(context.topic);
    this.logger.error(
      `Max retries (${maxRetries}) exhausted — topic=${context.topic} eventId=${context.eventId} → DLQ ${dlqTopic}`,
    );

    await this.dlqService.publish({
      id: randomUUID(),
      originalTopic: context.topic,
      dlqTopic,
      eventId: context.eventId,
      payload: context.originalPayload,
      errorMessage: lastError?.message ?? 'Unknown error',
      retryCount: attempt,
      timestamp: new Date().toISOString(),
    });

    return { retryCount: attempt, succeeded: false };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
