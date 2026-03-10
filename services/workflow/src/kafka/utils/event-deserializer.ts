import { Logger } from '@nestjs/common';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { EventEnvelopeDto } from '../dto/event-envelope.dto';

const logger = new Logger('EventDeserializer');

/**
 * Formats class-validator errors into a human-readable string.
 */
function formatValidationErrors(errors: ValidationError[], prefix = ''): string {
  return errors
    .map((err) => {
      const property = prefix ? `${prefix}.${err.property}` : err.property;
      const constraints = err.constraints ? Object.values(err.constraints).join(', ') : '';
      const children =
        err.children && err.children.length > 0
          ? formatValidationErrors(err.children, property)
          : '';
      return [constraints && `${property}: ${constraints}`, children].filter(Boolean).join('\n');
    })
    .join('\n');
}

/**
 * Deserializes a raw Kafka message value (Buffer | string | null) into
 * a typed EventEnvelopeDto and validates the envelope-level fields.
 *
 * Returns `null` on parse or validation failure after logging the error.
 */
export async function deserializeEnvelope(
  raw: Buffer | string | null | undefined,
): Promise<EventEnvelopeDto | null> {
  if (raw == null) {
    logger.warn('Received null/undefined Kafka message value — skipping');
    return null;
  }

  let parsed: unknown;
  try {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf-8') : raw;
    parsed = JSON.parse(text) as unknown;
  } catch (err) {
    logger.error(`Failed to JSON-parse Kafka message: ${String(err)}`);
    return null;
  }

  const envelope = plainToInstance(EventEnvelopeDto, parsed);
  const errors = await validate(envelope, {
    whitelist: true,
    forbidNonWhitelisted: false, // payload is typed per-topic
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    logger.error(`Envelope validation failed:\n${formatValidationErrors(errors)}`);
    return null;
  }

  return envelope;
}

/**
 * Validates and transforms a raw payload object into a typed DTO class.
 *
 * Returns `null` on validation failure after logging.
 */
export async function deserializePayload<T extends object>(
  DtoClass: ClassConstructor<T>,
  raw: unknown,
): Promise<T | null> {
  const instance = plainToInstance(DtoClass, raw, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    logger.error(
      `Payload validation failed for ${DtoClass.name}:\n${formatValidationErrors(errors)}`,
    );
    return null;
  }

  return instance;
}
