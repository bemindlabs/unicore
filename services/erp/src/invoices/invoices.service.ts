import { Injectable, Logger } from '@nestjs/common';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import type {
  InvoiceCreatedEventDto,
  InvoiceOverdueEventDto,
  InvoicePaidEventDto,
} from '../events/dto';

/**
 * InvoicesService
 *
 * Manages invoice lifecycle and publishes domain events to Kafka.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(private readonly eventPublisher: EventPublisherService) {}

  /**
   * Creates an invoice and emits invoice.created.
   */
  async createInvoice(data: InvoiceCreatedEventDto): Promise<InvoiceCreatedEventDto> {
    this.logger.log(`Creating invoice: invoiceId="${data.invoiceId}" number="${data.invoiceNumber}"`);

    // TODO: persist to database via Prisma

    await this.eventPublisher.publish<InvoiceCreatedEventDto>(
      ERP_TOPICS.INVOICE_CREATED,
      data,
      data.invoiceId,
    );

    return data;
  }

  /**
   * Marks an invoice as overdue and emits invoice.overdue.
   * Typically called by a scheduled job that scans unpaid invoices past their due date.
   */
  async markOverdue(data: InvoiceOverdueEventDto): Promise<void> {
    this.logger.warn(
      `Invoice overdue: invoiceId="${data.invoiceId}" daysOverdue=${data.daysOverdue}`,
    );

    // TODO: persist status update via Prisma

    await this.eventPublisher.publish<InvoiceOverdueEventDto>(
      ERP_TOPICS.INVOICE_OVERDUE,
      data,
      data.invoiceId,
    );
  }

  /**
   * Records payment and emits invoice.paid.
   */
  async recordPayment(data: InvoicePaidEventDto): Promise<InvoicePaidEventDto> {
    this.logger.log(
      `Invoice paid: invoiceId="${data.invoiceId}" amount=${data.amountPaid} ${data.currency}`,
    );

    // TODO: persist payment record via Prisma

    await this.eventPublisher.publish<InvoicePaidEventDto>(
      ERP_TOPICS.INVOICE_PAID,
      data,
      data.invoiceId,
    );

    return data;
  }
}
