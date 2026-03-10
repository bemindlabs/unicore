import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from '../src/invoices/invoices.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';
import { ERP_TOPICS } from '../src/events/event-types';
import { InvoiceStatus } from '../src/events/dto';
import type {
  InvoiceCreatedEventDto,
  InvoiceOverdueEventDto,
  InvoicePaidEventDto,
} from '../src/events/dto';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInvoice()', () => {
    const dto: InvoiceCreatedEventDto = {
      invoiceId: 'inv-001',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cust-001',
      amount: 500,
      tax: 50,
      total: 550,
      currency: 'USD',
      status: InvoiceStatus.SENT,
      issuedAt: '2026-03-01T00:00:00.000Z',
      dueAt: '2026-03-31T00:00:00.000Z',
    };

    it('publishes invoice.created event with invoiceId as key', async () => {
      const result = await service.createInvoice(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.INVOICE_CREATED,
        dto,
        'inv-001',
      );
      expect(result).toEqual(dto);
    });
  });

  describe('markOverdue()', () => {
    const dto: InvoiceOverdueEventDto = {
      invoiceId: 'inv-001',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cust-001',
      total: 550,
      currency: 'USD',
      dueAt: '2026-03-31T00:00:00.000Z',
      daysOverdue: 10,
    };

    it('publishes invoice.overdue event', async () => {
      await service.markOverdue(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.INVOICE_OVERDUE,
        dto,
        'inv-001',
      );
    });
  });

  describe('recordPayment()', () => {
    const dto: InvoicePaidEventDto = {
      invoiceId: 'inv-001',
      invoiceNumber: 'INV-2026-001',
      customerId: 'cust-001',
      amountPaid: 550,
      currency: 'USD',
      paymentMethod: 'credit_card',
      transactionId: 'txn-abc-123',
      paidAt: new Date().toISOString(),
    };

    it('publishes invoice.paid event with invoiceId as key', async () => {
      const result = await service.recordPayment(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.INVOICE_PAID,
        dto,
        'inv-001',
      );
      expect(result).toEqual(dto);
    });
  });
});
