import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  product: {
    findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  warehouse: { findFirst: jest.fn(), create: jest.fn() },
  inventoryItem: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  stockMovement: { findMany: jest.fn(), create: jest.fn(), count: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
};

const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InventoryService — CRUD extensions', () => {
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

  describe('create', () => {
    it('throws ConflictException when SKU already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sku: 'DUPLICATE' });

      await expect(
        service.create({ sku: 'DUPLICATE', name: 'Widget', unitPrice: 10 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('creates product without inventory when quantity is 0', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'p1', sku: 'NEW1', name: 'Widget' });

      const result = await service.create({ sku: 'NEW1', name: 'Widget', unitPrice: 10, quantity: 0 });
      expect(result.quantity).toBe(0);
      expect(mockPrisma.inventoryItem.create).not.toHaveBeenCalled();
    });

    it('creates product with inventory item and existing warehouse', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'p1', sku: 'NEW2', name: 'Widget' });
      mockPrisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', isDefault: true });
      mockPrisma.inventoryItem.create.mockResolvedValue({});

      const result = await service.create({ sku: 'NEW2', name: 'Widget', unitPrice: 10, quantity: 50 });
      expect(result.quantity).toBe(50);
      expect(mockPrisma.inventoryItem.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.warehouse.create).not.toHaveBeenCalled();
    });

    it('creates default warehouse when none exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({ id: 'p1', sku: 'NEW3', name: 'Widget' });
      mockPrisma.warehouse.findFirst.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({ id: 'wh-new', isDefault: true });
      mockPrisma.inventoryItem.create.mockResolvedValue({});

      await service.create({ sku: 'NEW3', name: 'Widget', unitPrice: 10, quantity: 10 });
      expect(mockPrisma.warehouse.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated products', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'p1', inventoryItems: [] }], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('flattens inventory data onto product', async () => {
      const product = {
        id: 'p1',
        inventoryItems: [{
          quantityOnHand: 15, quantityReserved: 2, quantityAvailable: 13, reorderPoint: 5,
        }],
      };
      mockPrisma.$transaction.mockResolvedValue([[product], 1]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.data[0].quantity).toBe(15);
      expect(result.data[0].reservedQuantity).toBe(2);
      expect(result.data[0].availableQuantity).toBe(13);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns product when found', async () => {
      const product = { id: 'p1', sku: 'SKU1', name: 'Widget' };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      const result = await service.findOne('p1');
      expect(result).toEqual(product);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'New Name' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException when updating to duplicate SKU', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sku: 'OLD' });
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p2', sku: 'TAKEN' });

      await expect(service.update('p1', { sku: 'TAKEN' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('updates product when SKU is unique', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sku: 'OLD' });
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.update.mockResolvedValue({ id: 'p1', sku: 'NEW', name: 'Updated' });

      const result = await service.update('p1', { sku: 'NEW', name: 'Updated' });
      expect(result.sku).toBe('NEW');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes existing product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.product.delete.mockResolvedValue({ id: 'p1' });

      await expect(service.remove('p1')).resolves.toBeUndefined();
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('restock', () => {
    it('throws BadRequestException when no inventory record exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1', sku: 'SKU1', name: 'Widget' });
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);

      await expect(service.restock('p1', { quantity: 20 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('restocks product and publishes INVENTORY_RESTOCKED event', async () => {
      const product = { id: 'p1', sku: 'SKU1', name: 'Widget' };
      const inventoryItem = {
        id: 'inv-1', productId: 'p1', quantityOnHand: 10, quantityReserved: 0, warehouseId: 'wh-1',
      };
      mockPrisma.product.findUnique.mockResolvedValue(product);
      mockPrisma.inventoryItem.findFirst.mockResolvedValue(inventoryItem);
      mockPrisma.stockMovement.create.mockResolvedValue({});
      mockPrisma.inventoryItem.update.mockResolvedValue({ ...inventoryItem, quantityOnHand: 30 });

      await service.restock('p1', { quantity: 20 });
      expect(mockPrisma.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'PURCHASE', quantity: 20, balanceAfter: 30 }),
        }),
      );
      expect(mockEvents.publish).toHaveBeenCalled();
    });
  });

  describe('getStockMovements', () => {
    it('throws NotFoundException when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);
      await expect(service.getStockMovements('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns stock movements for existing product', async () => {
      const movements = [{ id: 'mv-1', type: 'SALE', quantity: -5 }];
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.stockMovement.findMany.mockResolvedValue(movements);

      const result = await service.getStockMovements('p1');
      expect(result).toEqual(movements);
    });

    it('respects limit parameter', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      mockPrisma.stockMovement.findMany.mockResolvedValue([]);

      await service.getStockMovements('p1', 10);
      expect(mockPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('getLowStockProducts', () => {
    it('uses PostgreSQL view when view returns results', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ sku: 'SKU1' }]) // view query
        .mockResolvedValue([]);
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1', sku: 'SKU1' }]);

      const result = await service.getLowStockProducts();
      expect(result).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sku: { in: ['SKU1'] } } }),
      );
    });

    it('falls back to InventoryItem query when view returns empty', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // view returns nothing
        .mockResolvedValueOnce([{ product_id: 'p1' }]); // fallback query
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1', sku: 'SKU1' }]);

      const result = await service.getLowStockProducts();
      expect(result).toHaveLength(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['p1'] } } }),
      );
    });

    it('returns empty array when no low stock items', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getLowStockProducts();
      expect(result).toEqual([]);
    });
  });
});
