import type { KafkaOptions } from '@nestjs/microservices';
import { Transport } from '@nestjs/microservices';
import { WORKFLOW_CONSUMER_GROUP } from '../constants/kafka.constants';

/**
 * Resolves Kafka broker addresses from the environment.
 * Falls back to localhost for local development.
 */
export function getKafkaBrokers(): string[] {
  const raw = process.env['KAFKA_BROKERS'] ?? 'localhost:9092';
  return raw.split(',').map((b) => b.trim());
}

/**
 * NestJS microservice options for the Kafka transport (consumer side).
 * Uses Kafka 7.5 compatible settings.
 */
export function buildKafkaOptions(): KafkaOptions {
  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: process.env['KAFKA_CLIENT_ID'] ?? 'workflow-service',
        brokers: getKafkaBrokers(),
        ssl: process.env['KAFKA_SSL'] === 'true',
        sasl:
          process.env['KAFKA_SASL_USERNAME'] && process.env['KAFKA_SASL_PASSWORD']
            ? {
                mechanism: 'plain' as const,
                username: process.env['KAFKA_SASL_USERNAME']!,
                password: process.env['KAFKA_SASL_PASSWORD']!,
              }
            : undefined,
        retry: {
          initialRetryTime: 300,
          retries: 8,
        },
      },
      consumer: {
        groupId: WORKFLOW_CONSUMER_GROUP,
        allowAutoTopicCreation: false,
      },
    },
  };
}
