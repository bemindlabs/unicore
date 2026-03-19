import { Module, DynamicModule, Logger } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EventPublisherService } from './event-publisher.service';
import { NoopEventPublisherService } from './noop-event-publisher.service';

const logger = new Logger('KafkaModule');
const kafkaEnabled = process.env['ENABLE_KAFKA'] === 'true';

/**
 * Registers a named Kafka producer (ERP_KAFKA_PRODUCER) and exports
 * EventPublisherService for use across ERP feature modules.
 *
 * When Kafka is disabled (ENABLE_KAFKA !== 'true'), a no-op publisher
 * is provided so that feature modules work without Kafka.
 */
@Module({})
export class KafkaModule {
  static register(): DynamicModule {
    if (!kafkaEnabled) {
      logger.log('Kafka disabled — using no-op event publisher');
      return {
        module: KafkaModule,
        providers: [
          { provide: EventPublisherService, useClass: NoopEventPublisherService },
        ],
        exports: [EventPublisherService],
      };
    }

    const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
    logger.log(`Kafka enabled — brokers: ${brokers.join(', ')}`);

    return {
      module: KafkaModule,
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
    };
  }
}
