import { KafkaOptions, Transport } from '@nestjs/microservices';
import { WORKFLOW_CONSUMER_GROUP, WORKFLOW_TOPICS } from '../constants/kafka.constants';

/**
 * Builds the NestJS Kafka microservice options from environment variables.
 * Called once during application bootstrap.
 */
export function buildKafkaOptions(): KafkaOptions {
  const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  const clientId = process.env['KAFKA_CLIENT_ID'] ?? 'workflow-service';
  const groupId = process.env['KAFKA_CONSUMER_GROUP_ID'] ?? WORKFLOW_CONSUMER_GROUP;
  const connectionTimeout = Number(process.env['KAFKA_CONNECTION_TIMEOUT'] ?? 3000);
  const requestTimeout = Number(process.env['KAFKA_REQUEST_TIMEOUT'] ?? 30_000);
  const retryInitialRetryTime = Number(process.env['KAFKA_RETRY_INITIAL_RETRY_TIME'] ?? 100);
  const retryRetries = Number(process.env['KAFKA_RETRY_RETRIES'] ?? 8);

  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId,
        brokers,
        connectionTimeout,
        requestTimeout,
        retry: {
          initialRetryTime: retryInitialRetryTime,
          retries: retryRetries,
        },
      },
      consumer: {
        groupId,
      },
      subscribe: {
        fromBeginning: false,
      },
    },
  };
}

/** All topics this service subscribes to, exported for use in subscribe() calls. */
export const SUBSCRIBED_TOPICS = Object.values(WORKFLOW_TOPICS);
