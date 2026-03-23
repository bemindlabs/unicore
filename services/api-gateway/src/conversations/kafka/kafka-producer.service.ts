import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface KafkaMessageEvent {
  conversationId: string;
  messageId: string;
  channel: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  routedTo: 'agent' | 'unassigned';
  agentId?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * KafkaProducerService — publishes inbound conversation messages to Kafka.
 *
 * Uses kafkajs directly. Gracefully degrades when Kafka is unreachable:
 * messages are logged but processing continues without blocking the pipeline.
 *
 * Topic: chat.message.inbound
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: unknown = null;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const brokers = this.config.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn(
        'KAFKA_BROKERS not configured — Kafka publishing disabled. ' +
          'Messages will be logged only.',
      );
      return;
    }

    try {
      // Dynamic import to avoid hard dependency when Kafka is not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Kafka } = require('kafkajs') as typeof import('kafkajs');
      const kafka = new Kafka({
        clientId: 'unicore-api-gateway',
        brokers: brokers.split(',').map((b) => b.trim()),
        retry: { retries: 3, initialRetryTime: 300 },
      });
      this.producer = kafka.producer();
      await (this.producer as import('kafkajs').Producer).connect();
      this.connected = true;
      this.logger.log(`Kafka producer connected (brokers: ${brokers})`);
    } catch (err) {
      this.logger.warn(
        `Kafka producer connect failed — publishing disabled: ${(err as Error).message}`,
      );
      this.producer = null;
      this.connected = false;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.connected && this.producer) {
      try {
        await (this.producer as import('kafkajs').Producer).disconnect();
        this.logger.log('Kafka producer disconnected');
      } catch {
        // Ignore disconnect errors during shutdown
      }
    }
  }

  /**
   * Publish an inbound message event to `chat.message.inbound`.
   * Fire-and-forget with graceful degradation.
   */
  async publishInbound(event: KafkaMessageEvent): Promise<void> {
    if (!this.connected || !this.producer) {
      this.logger.debug(
        `[Kafka disabled] Would publish chat.message.inbound: conversationId=${event.conversationId}`,
      );
      return;
    }

    try {
      await (this.producer as import('kafkajs').Producer).send({
        topic: 'chat.message.inbound',
        messages: [
          {
            key: event.conversationId,
            value: JSON.stringify(event),
            headers: { channel: event.channel },
          },
        ],
      });
      this.logger.debug(
        `Published to chat.message.inbound: conversationId=${event.conversationId}, messageId=${event.messageId}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to publish to Kafka (chat.message.inbound): ${(err as Error).message}`,
      );
      // Graceful degradation — do not re-throw; message was already saved to DB
    }
  }
}
