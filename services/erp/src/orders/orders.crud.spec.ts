import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  contact: { findUnique: jest.fn() },
  product: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  order: {
    create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(),
    update: jest.fn(), count: jest.fn(),
  },
  inventoryItem: { findFirst: jest.fn(), update: jest.fn() },
  stockMovement: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('OrdersService — CRUD extensions', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ contactId: 'c1', lineItems: [{ productId: 'p1', quantity: 1 }] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when a product is not found', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'c1', email: 'contact@test.com' });
      mockPrisma.product.findMany.mockResolvedValue([]);

      await expect(
        service.create({ contactId: 'c1', lineItems: [{ productId: 'p1', quantity: 1 }] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates order successfully and publishes ORDER_CREATED event', async () => {
      const contact = { id: 'c1', email: 'contact@test.com' };
      const product = { id: 'p1', sku: 'SKU1', name: 'Widget', unitPrice: 10 };
      const orderResult = {
        id: 'ord-1', orderNumber: 'ORD-000001', status: 'DRAFT',
        contact: { id: 'c1' }, currency: 'USD',
        items: [{
          productId: 'p1', name: 'Widget', sku: 'SKU1',
          quantity: 2, unitPrice: 10, lineTotal: 20,
        }],
      };

      mockPrisma.contact.findUnique.mockResolvedValue(contact);
      mockPrisma.product.findMany.mockResolvedValue([product]);
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.create.mockResolvedValue(orderResult);

      const result = await service.create({
        contactId: 'c1',
        lineItems: [{ productId: 'p1', quantity: 2 }],
      });

      expect(result.orderNumber).toBe('ORD-000001');
      expect(result.status).toBe('DRAFT');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('uses product unitPrice when lineItem does not override it', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue({ id: 'c1', email: null });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 'p1', sku: 'SKU1', name: 'Widget', unitPrice: 25 },
      ]);
      mockPrisma.order.count.mockResolvedValue(5);
      const orderResult = {
        id: 'ord-6', orderNumber: 'ORD-000006', status: 'DRAFT',
        contact: { id: 'c1' }, currency: 'USD', items: [],
      };
      mockPrisma.order.create.mockResolvedValue(orderResult);

      await service.create({ contactId: 'c1', lineItems: [{ productId: 'p1', quantity: 1 }] });

      const createCall = mockPrisma.order.create.mock.calls[0][0];
      const lineItem = createCall.data.items.create[0];
      expect(Number(lineItem.unitPrice)).toBe(25);
    });
  });

  describe('findAll', () => {
    it('returns paginated orders', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'ord-1', status: 'DRAFT' }], 1]);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('applies status filter when provided', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 20, status: 'CONFIRMED' });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when order is in terminal status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'DELIVERED', contact: { id: 'c1' }, items: [],
      });

      await expect(service.update('ord-1', { notes: 'test' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a non-terminal order', async () => {
      const order = { id: 'ord-1', status: 'DRAFT', contact: { id: 'c1' }, items: [] };
      const updated = { ...order, notes: 'test note' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(updated);

      const result = await service.update('ord-1', { notes: 'test note' });
      expect(result.notes).toBe('test note');
    });

    it('throws BadRequestException for CANCELLED status', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'CANCELLED', contact: { id: 'c1' }, items: [],
      });

      await expect(service.update('ord-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('ship', () => {
    it('throws BadRequestException if order is in non-shippable state', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'DRAFT', contact: { id: 'c1' }, items: [],
      });

      await expect(service.ship('ord-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ships an order in PROCESSING status with tracking number', async () => {
      const order = { id: 'ord-1', status: 'PROCESSING', contact: { id: 'c1' }, items: [] };
      const shipped = { ...order, status: 'SHIPPED', trackingNumber: 'TRK123' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(shipped);

      const result = await service.ship('ord-1', { trackingNumber: 'TRK123' });
      expect(result.status).toBe('SHIPPED');
      expect(result.trackingNumber).toBe('TRK123');
    });
  });

  describe('fulfill', () => {
    it('throws BadRequestException if order is not in a fulfillable state', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'DRAFT', contact: { id: 'c1' }, items: [],
      });

      await expect(service.fulfill('ord-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fulfills a PROCESSING order with no line items', async () => {
      const order = {
        id: 'ord-1', status: 'PROCESSING', orderNumber: 'ORD-000001',
        contact: { id: 'c1' }, items: [],
      };
      const fulfilled = { ...order, status: 'FULFILLED' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn({
            inventoryItem: { findFirst: jest.fn(), update: jest.fn() },
            stockMovement: { create: jest.fn() },
          });
        }
        return fn;
      });
      mockPrisma.order.update.mockResolvedValue(fulfilled);

      const result = await service.fulfill('ord-1', {});
      expect(result.status).toBe('FULFILLED');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('throws BadRequestException when stock is insufficient during fulfillment', async () => {
      const order = {
        id: 'ord-1', status: 'PROCESSING', orderNumber: 'ORD-000002',
        contact: { id: 'c1' },
        items: [{ productId: 'p1', sku: 'SKU1', quantity: 10 }],
      };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          const mockTx = {
            inventoryItem: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'inv-1', productId: 'p1', quantityOnHand: 5,
                quantityReserved: 0, warehouseId: 'wh-1',
              }),
              update: jest.fn(),
            },
            stockMovement: { create: jest.fn() },
          };
          return fn(mockTx);
        }
        return fn;
      });

      await expect(service.fulfill('ord-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deliver', () => {
    it('throws BadRequestException if order cannot be delivered', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'DRAFT', contact: { id: 'c1' }, items: [],
      });

      await expect(service.deliver('ord-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('delivers a SHIPPED order and publishes event', async () => {
      const order = {
        id: 'ord-1', status: 'SHIPPED', orderNumber: 'ORD-000001',
        contact: { id: 'c1' }, items: [],
      };
      const delivered = { ...order, status: 'DELIVERED' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(delivered);

      const result = await service.deliver('ord-1');
      expect(result.status).toBe('DELIVERED');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('startProcessing', () => {
    it('transitions a CONFIRMED order to PROCESSING', async () => {
      const order = { id: 'ord-1', status: 'CONFIRMED', contact: { id: 'c1' }, items: [] };
      const processing = { ...order, status: 'PROCESSING' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(processing);

      const result = await service.startProcessing('ord-1');
      expect(result.status).toBe('PROCESSING');
    });

    it('throws BadRequestException when DRAFT cannot go to PROCESSING', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-1', status: 'DRAFT', contact: { id: 'c1' }, items: [],
      });

      await expect(service.startProcessing('ord-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('refund', () => {
    it('transitions a SHIPPED order to REFUNDED', async () => {
      const order = { id: 'ord-1', status: 'SHIPPED', contact: { id: 'c1' }, items: [] };
      const refunded = { ...order, status: 'REFUNDED' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(refunded);

      const result = await service.refund('ord-1');
      expect(result.status).toBe('REFUNDED');
    });
  });
});
