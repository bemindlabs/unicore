import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_CLIENT } from './kafka.module';
import type { ErpEventEnvelope, ErpTopic } from '../events/event-types';

/**
 * EventPublisherService
 *
 * Central service for publishing domain events to Kafka.
 * All ERP domain services (orders, inventory, invoices) delegate to this service.
 *
 * Key design decisions:
 * - Idempotent producer: each message has a stable eventId (UUID v4) so
 *   Kafka's idempotent producer can deduplicate retries at the broker level.
 * - Fire-and-forget with structured logging: callers are not blocked on
 *   broker acknowledgement beyond the producer's own retry policy.
 * - Strict typing: every publish call is parameterised so callers cannot
 *   misuse the envelope shape.
 */
@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private ready = false;

  constructor(
    @Inject(KAFKA_CLIENT)
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
    this.ready = true;
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaClient.close();
    this.ready = false;
    this.logger.log('Kafka producer disconnected');
  }

  /**
   * Publishes a typed domain event to the given Kafka topic.
   *
   * @param topic  - One of the ERP_TOPICS constants.
   * @param payload - Domain-specific event payload.
   * @param key    - Optional Kafka partition key (e.g. orderId / customerId).
   *                 Using a stable key ensures ordering within a partition.
   */
  async publish<T = unknown>(topic: ErpTopic, payload: T, key?: string): Promise<void> {
    if (!this.ready) {
      this.logger.warn(`Kafka producer not ready — dropping event for topic "${topic}"`);
      return;
    }

    const envelope: ErpEventEnvelope<T> = {
      eventId: uuidv4(),
      occurredAt: new Date().toISOString(),
      type: topic,
      source: 'erp-service',
      schemaVersion: 1,
      payload,
    };

    try {
      // emit() is fire-and-forget; the ClientKafka producer handles retries
      // internally per the retry policy set in KafkaModule.
      this.kafkaClient.emit(topic, {
        key: key ?? envelope.eventId,
        value: JSON.stringify(envelope),
        headers: {
          'x-event-id': envelope.eventId,
          'x-event-type': topic,
          'x-schema-version': String(envelope.schemaVersion),
          'x-source': envelope.source,
        },
      });

      this.logger.log(`Event published: topic="${topic}" eventId="${envelope.eventId}" key="${key ?? envelope.eventId}"`);
    } catch (err) {
      this.logger.error(
        `Failed to publish event: topic="${topic}" eventId="${envelope.eventId}"`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
