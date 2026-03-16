import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  product: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(), count: jest.fn(),
    fields: { lowStockThreshold: {} },
  },
  inventoryItem: { findFirst: jest.fn(), update: jest.fn() },
  stockMovement: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
};
const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<InventoryService>(InventoryService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('adjustStock', () => {
    it('throws BadRequestException when stock goes negative', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: '1', sku: 'SKU1', name: 'P1' });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue({ id: 'inv-1', productId: '1', quantityOnHand: 5, quantityReserved: 0, reorderPoint: 10, warehouseId: 'wh-1' });
      await expect(service.adjustStock('1', { delta: -10, reason: 'test' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('publishes low stock event when quantity falls below threshold', async () => {
      const product = { id: '1', sku: 'SKU1', name: 'P1' };
      const inventoryItem = { id: 'inv-1', productId: '1', quantityOnHand: 5, quantityReserved: 0, reorderPoint: 10, warehouseId: 'wh-1' };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(inventoryItem);
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...inventoryItem, quantityOnHand: 3 });
      await service.adjustStock('1', { delta: -2, reason: 'sale' });
      expect(mockEvents.publish).toHaveBeenCalled();
    });
  });
});
