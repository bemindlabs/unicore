import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisherService } from '../src/kafka/event-publisher.service';
import { ERP_TOPICS } from '../src/events/event-types';
import { OrderStatusEvent, FulfillmentStatusEvent } from '../src/events/dto';
import type { OrderCreatedEventDto } from '../src/events/dto';

/** Minimal ClientKafka stub */
const mockKafkaClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  emit: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
};

describe('EventPublisherService', () => {
  let service: EventPublisherService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisherService,
        { provide: 'ERP_KAFKA_PRODUCER', useValue: mockKafkaClient },
      ],
    }).compile();

    service = module.get<EventPublisherService>(EventPublisherService);

    // Simulate module init
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('connects on module init', () => {
    expect(mockKafkaClient.connect).toHaveBeenCalledTimes(1);
  });

  describe('publish()', () => {
    const payload: OrderCreatedEventDto = {
      orderId: 'ord-001',
      orderNumber: 'ORD-000001',
      contactId: 'cust-123',
      status: OrderStatusEvent.CONFIRMED,
      fulfillmentStatus: FulfillmentStatusEvent.PENDING,
      items: [
        {
          productId: 'prod-1',
          name: 'Widget',
          sku: 'WGT-001',
          quantity: 2,
          unitPrice: 10,
          lineTotal: 20,
        },
      ],
      subtotal: 20,
      taxAmount: 2,
      total: 22,
      currency: 'USD',
    };

    it('emits an event envelope to the correct Kafka topic', async () => {
      await service.publish(ERP_TOPICS.ORDER_CREATED, payload, 'ord-001');

      expect(mockKafkaClient.emit).toHaveBeenCalledTimes(1);
      const [topic, message] = mockKafkaClient.emit.mock.calls[0] as [string, { key: string; value: string; headers: Record<string, string> }];

      expect(topic).toBe('order.created');
      expect(message.key).toBe('ord-001');

      const envelope = JSON.parse(message.value);
      expect(envelope.type).toBe('order.created');
      expect(envelope.source).toBe('erp-service');
      expect(envelope.schemaVersion).toBe(1);
      expect(envelope.payload).toEqual(payload);
      expect(envelope.eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('uses a UUID as partition key when no key is provided', async () => {
      await service.publish(ERP_TOPICS.ORDER_UPDATED, payload);

      const [, message] = mockKafkaClient.emit.mock.calls[0] as [string, { key: string }];
      expect(message.key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('re-throws when emit throws', async () => {
      mockKafkaClient.emit.mockImplementationOnce(() => {
        throw new Error('Broker unavailable');
      });

      await expect(
        service.publish(ERP_TOPICS.ORDER_CREATED, payload, 'ord-001'),
      ).rejects.toThrow('Broker unavailable');
    });
  });
});
