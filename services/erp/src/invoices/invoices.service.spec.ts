import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  invoice: {
    findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(),
    update: jest.fn(), updateMany: jest.fn(), delete: jest.fn(), count: jest.fn(),
  },
  payment: { create: jest.fn() },
  $transaction: jest.fn(),
};
const mockEvents = { publish: jest.fn().mockResolvedValue(undefined) };

describe('InvoicesService', () => {
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

  it('should be defined', () => expect(service).toBeDefined());

  describe('send', () => {
    it('throws when invoice is not DRAFT', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ id: '1', status: 'SENT' });
      await expect(service.send('1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('recordPayment', () => {
    it('marks invoice as PAID when full amount received', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: '1', status: 'SENT', total: 100, amountPaid: 0, currency: 'USD',
        invoiceNumber: 'INV-001', contactId: 'c1',
      });
      const paidInvoice = { id: '1', status: 'PAID', amountPaid: 100 };
      mockPrisma.$transaction.mockResolvedValue([paidInvoice, {}]);
      const result = await service.recordPayment('1', { amount: 100 });
      expect(result.status).toBe('PAID');
    });
  });
});
