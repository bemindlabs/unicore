import { KafkaOptions, Transport } from '@nestjs/microservices';

/**
 * KafkaJS / NestJS microservice options for the ERP service.
 * Reads broker addresses from environment; defaults to localhost for dev.
 */
export function getKafkaConfig(): KafkaOptions {
  const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');

  return {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'erp-service',
        brokers,
      },
      consumer: {
        groupId: 'erp-consumer-group',
      },
      producer: {
        allowAutoTopicCreation: false,
      },
    },
  };
}
