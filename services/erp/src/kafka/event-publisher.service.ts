import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { ErpEventEnvelope, ErpTopic } from '../events/event-types';

/**
 * Thin wrapper around the Kafka producer client.
 * Inject this service to emit typed ERP domain events from any feature module.
 */
@Injectable()
export class EventPublisherService implements OnModuleInit {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    @Inject('ERP_KAFKA_PRODUCER')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaClient.connect();
    this.logger.log('Kafka producer connected');
  }

  /**
   * Publish a domain event to the given Kafka topic.
   * Wraps the payload in a typed ErpEventEnvelope with a new UUID and timestamp.
   */
  async publish<T>(topic: ErpTopic, payload: T, partitionKey?: string): Promise<void> {
    const envelope: ErpEventEnvelope<T> = {
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      type: topic,
      source: 'erp-service',
      schemaVersion: 1,
      payload,
    };

    this.kafkaClient.emit(topic, {
      key: partitionKey ?? envelope.eventId,
      value: JSON.stringify(envelope),
    });

    this.logger.debug(`Published ${topic}: ${envelope.eventId}`);
  }
}
