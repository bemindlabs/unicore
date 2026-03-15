import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  inventoryItem: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  stockMovement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne()', () => {
    it('throws NotFoundException when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow('not found');
    });
  });
});
