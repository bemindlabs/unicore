import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  contact: { findUnique: jest.fn() },
  order: { findUnique: jest.fn() },
  invoice: {
    create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(),
    update: jest.fn(), count: jest.fn(),
  },
  payment: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should transition DRAFT invoice to SENT and publish event', async () => {
      const invoice = {
        id: 'inv-1', status: 'DRAFT', invoiceNumber: 'INV-2026-00001',
        contactId: 'c-1', total: '100.00', currency: 'USD',
        dueDate: null, amountPaid: '0', contact: {}, lineItems: [], payments: [],
      };
      const sent = { ...invoice, status: 'SENT', issuedAt: new Date() };
      mockPrisma.invoice.findUnique.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue(sent);

      const result = await service.send('inv-1');
      expect(result.status).toBe('SENT');
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw if invoice is not DRAFT', async () => {
      const invoice = { id: 'inv-1', status: 'SENT', contact: {}, lineItems: [], payments: [] };
      mockPrisma.invoice.findUnique.mockResolvedValue(invoice);

      await expect(service.send('inv-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordPayment', () => {
    it('should throw if payment exceeds remaining balance', async () => {
      const invoice = {
        id: 'inv-1', status: 'SENT', total: '100.00', amountPaid: '80.00',
        currency: 'USD', contact: {}, lineItems: [], payments: [],
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(invoice);

      await expect(
        service.recordPayment('inv-1', { amount: 50 } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
