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
  stockMovement: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('OrdersService', () => {
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

  describe('findOne', () => {
    it('should throw NotFoundException for missing order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('should transition DRAFT to CONFIRMED', async () => {
      const order = {
        id: 'ord-1', status: 'DRAFT', orderNumber: 'ORD-000001',
        contact: { id: 'c-1' }, lineItems: [],
      };
      const updated = { ...order, status: 'CONFIRMED' };
      mockPrisma.order.findUnique.mockResolvedValue(order);
      mockPrisma.order.update.mockResolvedValue(updated);

      const result = await service.confirm('ord-1');
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('cancel', () => {
    it('should not allow cancelling a FULFILLED order', async () => {
      const order = {
        id: 'ord-1', status: 'FULFILLED', contact: { id: 'c-1' }, lineItems: [],
      };
      mockPrisma.order.findUnique.mockResolvedValue(order);

      await expect(service.cancel('ord-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
