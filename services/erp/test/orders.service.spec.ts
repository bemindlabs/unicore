import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  contact: {
    findUnique: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  order: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  inventoryItem: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne()', () => {
    it('throws NotFoundException when order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow('not found');
    });
  });
});
