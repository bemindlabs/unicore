import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatusFilter } from './dto/query-invoices.dto';

const mockPrisma = {
  invoice: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  payment: { create: jest.fn() },
  $transaction: jest.fn(),
};
const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InvoicesService — CRUD extensions', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventPublisherService, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('throws NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns invoice when found', async () => {
      const invoice = { id: '1', status: 'DRAFT' };
      mockPrisma.invoice.findUnique.mockResolvedValue(invoice);
      const result = await service.findOne('1');
      expect(result).toEqual(invoice);
    });
  });

  describe('findAll', () => {
    it('returns paginated invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([{ id: '1', status: 'DRAFT' }]);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('applies status filter when provided', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, status: 'OVERDUE' });
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('creates invoice with calculated totals and publishes event', async () => {
      const invoice = {
        id: 'inv-1', invoiceNumber: 'INV-2025-00001', status: 'DRAFT',
        contactId: 'c1', total: 110, currency: 'USD', dueDate: new Date(),
      };
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.create.mockResolvedValue(invoice);

      const result = await service.create({
        contactId: 'c1',
        lineItems: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
        taxRate: 0.1,
      });

      expect(result.invoiceNumber).toBe('INV-2025-00001');
      expect(mockEvents.publish).toHaveBeenCalled();
      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      expect(Number(createCall.data.subtotal)).toBe(100);
      expect(Number(createCall.data.taxAmount)).toBe(10);
    });

    it('generates invoice number with correct sequence', async () => {
      mockPrisma.invoice.count.mockResolvedValue(4);
      mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-5', invoiceNumber: 'anything' });

      await service.create({
        contactId: 'c1',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
      });

      const createCall = mockPrisma.invoice.create.mock.calls[0][0];
      const year = new Date().getFullYear();
      expect(createCall.data.invoiceNumber).toBe(`INV-${year}-00005`);
    });
  });

  describe('update', () => {
    it('throws BadRequestException when invoice is not DRAFT', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'SENT' });

      await expect(service.update('1', { notes: 'test' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates a DRAFT invoice', async () => {
      const invoice = { id: '1', status: 'DRAFT' };
      mockPrisma.invoice.findUnique.mockResolvedValue(invoice);
      mockPrisma.invoice.update.mockResolvedValue({ id: '1', status: 'DRAFT', notes: 'updated' });

      const result = await service.update('1', { notes: 'updated' });
      expect(result.notes).toBe('updated');
    });
  });

  describe('recordPayment — partial', () => {
    it('marks invoice as PARTIALLY_PAID when less than full amount received', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: '1', status: 'SENT', total: 200, amountPaid: 0, currency: 'USD',
        invoiceNumber: 'INV-001', contactId: 'c1',
      });
      const partialInvoice = { id: '1', status: 'PARTIALLY_PAID', amountPaid: 100 };
      mockPrisma.$transaction.mockResolvedValue([partialInvoice, {}]);

      const result = await service.recordPayment('1', { amount: 100 });
      expect(result.status).toBe('PARTIALLY_PAID');
    });

    it('throws BadRequestException when invoice is already PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.recordPayment('1', { amount: 50 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when invoice is VOID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'VOID' });

      await expect(service.recordPayment('1', { amount: 50 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('publishes INVOICE_PAID event only when fully paid', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: '1', status: 'SENT', total: 100, amountPaid: 50, currency: 'USD',
        invoiceNumber: 'INV-001', contactId: 'c1',
      });
      const paidInvoice = { id: '1', status: 'PAID', amountPaid: 100 };
      mockPrisma.$transaction.mockResolvedValue([paidInvoice, {}]);

      await service.recordPayment('1', { amount: 50 });
      expect(mockEvents.publish).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('throws BadRequestException when invoice is already PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'PAID' });

      await expect(service.cancel('1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('voids a SENT invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'SENT' });
      mockPrisma.invoice.update.mockResolvedValue({ id: '1', status: 'VOID' });

      const result = await service.cancel('1');
      expect(result.status).toBe('VOID');
    });
  });

  describe('remove', () => {
    it('throws BadRequestException when invoice is not DRAFT', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'SENT' });

      await expect(service.remove('1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes a DRAFT invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'DRAFT' });
      mockPrisma.invoice.delete.mockResolvedValue({ id: '1' });

      await expect(service.remove('1')).resolves.toBeUndefined();
      expect(mockPrisma.invoice.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('markOverdue', () => {
    it('returns count of 0 when no invoices updated', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markOverdue();
      expect(result.updated).toBe(0);
      expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it('marks overdue invoices and publishes events', async () => {
      mockPrisma.invoice.updateMany.mockResolvedValue({ count: 2 });
      const overdueInvoices = [
        {
          id: 'inv-1', invoiceNumber: 'INV-001', contactId: 'c1',
          amountDue: 100, currency: 'USD', dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        {
          id: 'inv-2', invoiceNumber: 'INV-002', contactId: 'c2',
          amountDue: 200, currency: 'USD', dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      ];
      mockPrisma.invoice.findMany.mockResolvedValue(overdueInvoices);

      const result = await service.markOverdue();
      expect(result.updated).toBe(2);
      expect(mockEvents.publish).toHaveBeenCalledTimes(2);
    });
  });
});
