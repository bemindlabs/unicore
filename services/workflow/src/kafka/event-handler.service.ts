import { Injectable, Logger } from '@nestjs/common';
import { WorkflowTopic } from './constants/kafka.constants';
import { EventEnvelopeDto } from './dto/event-envelope.dto';

export interface EventHandlerResult {
  topic: WorkflowTopic;
  eventId: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

/**
 * EventHandlerService acts as a central dispatcher and audit log for
 * all processed Kafka events.  Individual consumer services call
 * `recordResult` after handling each message.
 */
@Injectable()
export class EventHandlerService {
  private readonly logger = new Logger(EventHandlerService.name);

  /**
   * Records and logs the outcome of a consumed event.
   * In a production system this could write to an events table / tracing system.
   */
  recordResult(result: EventHandlerResult): void {
    if (result.success) {
      this.logger.log(
        `[OK] topic=${result.topic} eventId=${result.eventId} duration=${result.durationMs}ms`,
      );
    } else {
      this.logger.error(
        `[FAIL] topic=${result.topic} eventId=${result.eventId} duration=${result.durationMs}ms error=${result.error ?? 'unknown'}`,
      );
    }
  }

  /**
   * Helper that wraps a handler callback, measures its duration, and calls
   * recordResult regardless of success or failure.
   */
  async handle<T>(
    envelope: EventEnvelopeDto<T>,
    handler: (payload: T) => Promise<void>,
  ): Promise<void> {
    const start = Date.now();
    try {
      await handler(envelope.payload);
      this.recordResult({
        topic: envelope.type,
        eventId: envelope.eventId,
        success: true,
        durationMs: Date.now() - start,
      });
    } catch (err) {
      this.recordResult({
        topic: envelope.type,
        eventId: envelope.eventId,
        success: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw so Kafka can apply its retry / DLQ policy.
      throw err;
    }
  }
}
