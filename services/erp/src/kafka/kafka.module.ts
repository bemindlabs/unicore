import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisherService } from './event-publisher.service';

const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');

/**
 * Registers a named Kafka producer (ERP_KAFKA_PRODUCER) and exports
 * EventPublisherService for use across ERP feature modules.
 */
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ERP_KAFKA_PRODUCER',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'erp-producer',
            brokers,
          },
          producer: {
            allowAutoTopicCreation: false,
          },
        },
      },
    ]),
  ],
  providers: [EventPublisherService],
  exports: [EventPublisherService],
})
export class KafkaModule {}
