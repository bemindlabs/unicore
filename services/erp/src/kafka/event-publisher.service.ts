import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_CLIENT } from './kafka.module';
import type { ErpEventEnvelope, ErpTopic } from '../events/event-types';

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private ready = false;

  constructor(@Inject(KAFKA_CLIENT) private readonly kafkaClient: ClientKafka) {}

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

  async publish<T = unknown>(topic: ErpTopic, payload: T, key?: string): Promise<void> {
    if (!this.ready) {
      this.logger.warn(`Kafka not ready - dropping event for topic "${topic}"`);
      return;
    }
    const envelope: ErpEventEnvelope<T> = {
      eventId: uuidv4(), occurredAt: new Date().toISOString(),
      type: topic, source: 'erp-service', schemaVersion: 1, payload,
    };
    try {
      this.kafkaClient.emit(topic, {
        key: key ?? envelope.eventId,
        value: JSON.stringify(envelope),
        headers: {
          'x-event-id': envelope.eventId, 'x-event-type': topic,
          'x-schema-version': String(envelope.schemaVersion), 'x-source': envelope.source,
        },
      });
      this.logger.log(`Event published: topic="${topic}" eventId="${envelope.eventId}"`);
    } catch (err) {
      this.logger.error(`Failed to publish event: topic="${topic}"`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }
}
