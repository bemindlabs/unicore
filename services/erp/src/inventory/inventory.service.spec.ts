import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  product: {
    findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  stockMovement: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const dto = { sku: 'SKU-001', name: 'Widget', unitPrice: 9.99 };
      const expected = { id: 'prod-1', ...dto };
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(expected);

      const result = await service.create(dto as any);
      expect(result).toEqual(expected);
    });

    it('should throw ConflictException for duplicate SKU', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ sku: 'DUPE', name: 'Test', unitPrice: 1 } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock positively', async () => {
      const product = { id: 'p1', sku: 'SKU-001', quantity: 10, lowStockThreshold: 5 };
      const updated = { ...product, quantity: 15 };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await service.adjustStock('p1', { delta: 5, reason: 'test' } as any);
      expect(result.quantity).toBe(15);
    });

    it('should throw BadRequestException when stock goes negative', async () => {
      const product = { id: 'p1', sku: 'SKU-001', quantity: 2, lowStockThreshold: 5 };
      mockPrisma.product.findUnique.mockResolvedValue(product);

      await expect(
        service.adjustStock('p1', { delta: -5, reason: 'test' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('restock', () => {
    it('should increase quantity and publish event', async () => {
      const product = { id: 'p1', sku: 'SKU-001', name: 'Widget', quantity: 5, lowStockThreshold: 10 };
      const updated = { ...product, quantity: 55 };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.product.update.mockResolvedValue(updated);

      const result = await service.restock('p1', { quantity: 50 } as any);
      expect(result.quantity).toBe(55);
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });
});
