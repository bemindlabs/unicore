import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

export interface DlqEntry {
  id: string;
  originalTopic: string;
  dlqTopic: string;
  eventId: string;
  payload: unknown;
  errorMessage: string;
  retryCount: number;
  timestamp: string;
  retriedAt?: string;
}

/**
 * DlqService manages the Dead Letter Queue for failed Kafka events.
 *
 * Responsibilities:
 * - Maintains an in-memory store of all DLQ entries for REST API access
 * - Publishes failed messages to their domain-specific DLQ Kafka topic
 * - Supports manual retry via the REST API (markRetried)
 */
@Injectable()
export class DlqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqService.name);
  private readonly entries = new Map<string, DlqEntry>();
  private producer!: Producer;

  async onModuleInit(): Promise<void> {
    const kafka = new Kafka({
      clientId: 'workflow-dlq-producer',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    });
    this.producer = kafka.producer();
    try {
      await this.producer.connect();
      this.logger.log('DLQ Kafka producer connected');
    } catch (err) {
      // Non-fatal: log and continue — publish() handles errors gracefully
      this.logger.error(
        `DLQ producer connect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.producer.disconnect();
    } catch {
      // Ignore disconnect errors during shutdown
    }
  }

  /**
   * Stores the DLQ entry in memory and publishes it to the Kafka DLQ topic.
   * Publish failures are logged but do not throw — the in-memory store
   * is always updated so the REST API can still list/retry the entry.
   */
  async publish(entry: DlqEntry): Promise<void> {
    this.entries.set(entry.id, entry);

    try {
      await this.producer.send({
        topic: entry.dlqTopic,
        messages: [
          {
            key: entry.eventId,
            value: JSON.stringify(entry),
          },
        ],
      });
      this.logger.log(
        `DLQ published — id=${entry.id} originalTopic=${entry.originalTopic} dlqTopic=${entry.dlqTopic} retries=${entry.retryCount}`,
      );
    } catch (err) {
      this.logger.error(
        `DLQ Kafka publish failed for topic=${entry.dlqTopic}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Returns all DLQ entries, newest first. */
  list(): DlqEntry[] {
    return Array.from(this.entries.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /** Returns a single DLQ entry by ID, or undefined if not found. */
  get(id: string): DlqEntry | undefined {
    return this.entries.get(id);
  }

  /** Marks an entry as retried (sets retriedAt timestamp). Returns false if not found. */
  markRetried(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.entries.set(id, { ...entry, retriedAt: new Date().toISOString() });
    return true;
  }
}
