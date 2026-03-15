import { IsString, IsNotEmpty, IsNumber, IsDateString, Min } from 'class-validator';
import { WorkflowTopic } from '../constants/kafka.constants';

/**
 * Generic envelope wrapping every ERP domain event published to Kafka.
 * Must match the ErpEventEnvelope interface published by the erp service.
 */
export class EventEnvelopeDto<T = unknown> {
  /** Unique event ID (UUID v4). */
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  /** ISO 8601 timestamp when the event was created. */
  @IsDateString()
  occurredAt!: string;

  /** Topic / event type — mirrors the Kafka topic key. */
  @IsString()
  @IsNotEmpty()
  type!: WorkflowTopic;

  /** Service that produced the event. */
  @IsString()
  @IsNotEmpty()
  source!: string;

  /** Schema version — bump on breaking payload changes. */
  @IsNumber()
  @Min(1)
  schemaVersion!: number;

  /** Domain-specific payload — validated separately per topic. */
  payload!: T;
}

/**
 * Typed helper so callers can reference a strongly-typed envelope
 * without needing to re-declare the generic each time.
 */
export type TypedEnvelope<T> = EventEnvelopeDto<T>;
