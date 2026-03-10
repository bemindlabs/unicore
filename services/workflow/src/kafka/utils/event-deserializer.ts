import { Logger } from '@nestjs/common';
import type { EventEnvelopeDto } from '../dto/event-envelope.dto';

const logger = new Logger('EventDeserializer');

/**
 * Safely deserializes a raw Kafka message value into an EventEnvelopeDto.
 * Returns null on parse failure so consumers can skip the message gracefully.
 */
export async function deserializeEnvelope<T = unknown>(
  raw: Buffer | string | null | undefined,
): Promise<EventEnvelopeDto<T> | null> {
  if (raw == null) {
    logger.warn('Received null/undefined Kafka message value — skipping');
    return null;
  }

  const text = typeof raw === 'string' ? raw : raw.toString('utf-8');

  try {
    const parsed = JSON.parse(text) as EventEnvelopeDto<T>;
    if (!parsed.eventId || !parsed.type || !parsed.payload) {
      logger.warn(`Invalid envelope structure: ${text.slice(0, 200)}`);
      return null;
    }
    return parsed;
  } catch (err) {
    logger.error(`Failed to parse Kafka message: ${String(err)}`);
    return null;
  }
}

/**
 * Validates and returns the typed payload from a parsed envelope.
 * The constructor parameter is used only for TypeScript type inference.
 * Returns null on validation failure.
 */
export async function deserializePayload<T>(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dtoClass: new () => T,
  payload: unknown,
): Promise<T | null> {
  if (payload == null || typeof payload !== 'object') {
    logger.warn('Payload is not an object — skipping');
    return null;
  }
  // Runtime validation via class-validator/class-transformer would go here.
  // For now we trust the envelope schema and cast.
  return payload as T;
}
