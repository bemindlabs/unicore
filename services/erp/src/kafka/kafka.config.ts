import type { KafkaOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';

/**
 * Resolves Kafka broker addresses from the environment.
 * Falls back to localhost for local development.
 */
export function getKafkaBrokers(): string[] {
  const raw = process.env.KAFKA_BROKERS ?? 'localhost:9092';
  return raw.split(',').map((b) => b.trim());
}

/**
 * NestJS microservice options for the Kafka transport (producer side).
 * Uses Kafka 7.5 compatible settings.
 */
export function buildKafkaOptions(): KafkaOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env.KAFKA_CLIENT_ID ?? 'erp-service',
        brokers: getKafkaBrokers(),
        ssl: process.env.KAFKA_SSL === 'true',
        sasl:
          process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
            ? {
                mechanism: 'plain' as const,
                username: process.env.KAFKA_SASL_USERNAME,
                password: process.env.KAFKA_SASL_PASSWORD,
              }
            : undefined,
        retry: {
          initialRetryTime: 300,
          retries: 8,
        },
      },
      producer: {
        allowAutoTopicCreation: false,
        idempotent: true,
        transactionTimeout: 30_000,
      },
      producerOnlyMode: true,
    },
  };
}
