import { Injectable, Logger } from '@nestjs/common';
import { ErpTopic } from '../events/event-types';

/**
 * No-op event publisher used when Kafka is disabled.
 * Silently discards events so feature modules work without Kafka.
 */
@Injectable()
export class NoopEventPublisherService {
  private readonly logger = new Logger(NoopEventPublisherService.name);

  async onModuleInit(): Promise<void> {
    this.logger.log('No-op event publisher active (Kafka disabled)');
  }

  async publish<T>(topic: ErpTopic, _payload: T, _partitionKey?: string): Promise<void> {
    this.logger.debug(`Event discarded (Kafka disabled): ${topic}`);
  }
}
