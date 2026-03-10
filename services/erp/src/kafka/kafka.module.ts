import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { getKafkaBrokers } from './kafka.config';
import { EventPublisherService } from './event-publisher.service';

export const KAFKA_CLIENT = 'KAFKA_ERP_CLIENT';

@Module({
  imports: [
    ClientsModule.register([{
      name: KAFKA_CLIENT,
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID ?? 'erp-service',
          brokers: getKafkaBrokers(),
          ssl: process.env.KAFKA_SSL === 'true',
          sasl: process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD ? {
            mechanism: 'plain' as const,
            username: process.env.KAFKA_SASL_USERNAME!,
            password: process.env.KAFKA_SASL_PASSWORD!,
          } : undefined,
          retry: { initialRetryTime: 300, retries: 8 },
        },
        producer: { allowAutoTopicCreation: false, idempotent: true },
        producerOnlyMode: true,
      },
    }]),
  ],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class KafkaModule {}
