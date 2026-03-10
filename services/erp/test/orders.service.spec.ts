import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../src/orders/orders.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';
import { ERP_TOPICS } from '../src/events/event-types';
import { OrderStatus } from '../src/events/dto';
import type {
  OrderCreatedEventDto,
  OrderUpdatedEventDto,
  OrderFulfilledEventDto,
} from '../src/events/dto';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder()', () => {
    const dto: OrderCreatedEventDto = {
      orderId: 'ord-001',
      customerId: 'cust-001',
      status: OrderStatus.CONFIRMED,
      lineItems: [
        {
          productId: 'prod-1',
          productName: 'Widget',
          sku: 'WGT-001',
          quantity: 1,
          unitPrice: 50,
          totalPrice: 50,
        },
      ],
      subtotal: 50,
      tax: 5,
      total: 55,
      currency: 'USD',
    };

    it('publishes order.created event with orderId as key', async () => {
      const result = await service.createOrder(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.ORDER_CREATED,
        dto,
        'ord-001',
      );
      expect(result).toEqual(dto);
    });
  });

  describe('updateOrder()', () => {
    const dto: OrderUpdatedEventDto = {
      orderId: 'ord-001',
      customerId: 'cust-001',
      previousStatus: OrderStatus.CONFIRMED,
      newStatus: OrderStatus.PROCESSING,
    };

    it('publishes order.updated event', async () => {
      const result = await service.updateOrder(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.ORDER_UPDATED,
        dto,
        'ord-001',
      );
      expect(result).toEqual(dto);
    });
  });

  describe('fulfillOrder()', () => {
    const dto: OrderFulfilledEventDto = {
      orderId: 'ord-001',
      customerId: 'cust-001',
      trackingNumber: 'TRK-12345',
      carrier: 'FedEx',
      fulfilledAt: new Date().toISOString(),
    };

    it('publishes order.fulfilled event', async () => {
      const result = await service.fulfillOrder(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.ORDER_FULFILLED,
        dto,
        'ord-001',
      );
      expect(result).toEqual(dto);
    });
  });
});
