import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

const INVOICE_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  lineItems: true,
  payments: { orderBy: { paidAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(dto: CreateInvoiceDto): Promise<InvoiceWithRelations> {
    const contact = await this.prisma.contact.findUnique({ where: { id: dto.contactId } });
    if (!contact) throw new NotFoundException(`Contact ${dto.contactId} not found`);
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);
    }

    const lineItemsData: Prisma.InvoiceItemCreateWithoutInvoiceInput[] = dto.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      totalPrice: li.unitPrice * li.quantity,
    }));

    const subtotal = lineItemsData.reduce((sum, li) => sum + Number(li.totalPrice), 0);
    const taxRate = dto.taxRate ?? 0;
    const taxAmount = subtotal * taxRate;
    const discount = dto.discount ?? 0;
    const total = subtotal + taxAmount - discount;
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        contact: { connect: { id: dto.contactId } },
        ...(dto.orderId && { order: { connect: { id: dto.orderId } } }),
        status: 'DRAFT',
        lineItems: { create: lineItemsData },
        subtotal, taxRate, taxAmount, discount, total,
        amountPaid: 0,
        currency: dto.currency ?? 'USD',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
      include: INVOICE_INCLUDE,
    });

    this.logger.log(`Invoice created: ${invoice.invoiceNumber}`);
    return invoice;
  }

  async findAll(query: QueryInvoicesDto): Promise<PaginatedResult<InvoiceWithRelations>> {
    const { page = 1, limit = 20, status, contactId, search } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.InvoiceWhereInput = {
      ...(status && { status }),
      ...(contactId && { contactId }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: INVOICE_INCLUDE }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto): Promise<InvoiceWithRelations> {
    const invoice = await this.findOne(id);
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot update a ${invoice.status.toLowerCase()} invoice`);
    }
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      },
      include: INVOICE_INCLUDE,
    });
  }

  async send(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT invoices can be sent. Current: ${invoice.status}`);
    }
    const sent = await this.prisma.invoice.update({
      where: { id }, data: { status: 'SENT', issuedAt: new Date() }, include: INVOICE_INCLUDE,
    });
    this.eventPublisher.publish(ERP_TOPICS.INVOICE_CREATED, {
      invoiceId: id, invoiceNumber: invoice.invoiceNumber,
      contactId: invoice.contactId, total: Number(invoice.total),
      currency: invoice.currency, dueDate: invoice.dueDate?.toISOString(),
    }, id).catch((err: unknown) => this.logger.error('Failed to publish invoice.created', err));
    return sent;
  }

  async recordPayment(id: string, dto: RecordPaymentDto): Promise<InvoiceWithRelations> {
    const invoice = await this.findOne(id);
    if (invoice.status === 'CANCELLED') throw new BadRequestException('Cannot record payment for a cancelled invoice');
    if (invoice.status === 'PAID') throw new BadRequestException('Invoice is already fully paid');

    const remaining = Number(invoice.total) - Number(invoice.amountPaid);
    if (dto.amount > remaining + 0.001) {
      throw new BadRequestException(`Payment amount ${dto.amount} exceeds remaining balance ${remaining.toFixed(2)}`);
    }

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const fullyPaid = newAmountPaid >= Number(invoice.total) - 0.001;

    await this.prisma.payment.create({
      data: {
        invoiceId: id, amount: dto.amount,
        currency: dto.currency ?? invoice.currency,
        method: dto.method ?? 'BANK_TRANSFER',
        reference: dto.reference, notes: dto.notes,
      },
    });

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { amountPaid: newAmountPaid, ...(fullyPaid && { status: 'PAID', paidAt: new Date() }) },
      include: INVOICE_INCLUDE,
    });

    if (fullyPaid) {
      this.eventPublisher.publish(ERP_TOPICS.INVOICE_PAID, {
        invoiceId: id, invoiceNumber: invoice.invoiceNumber,
        contactId: invoice.contactId, amountPaid: newAmountPaid,
        currency: invoice.currency, paymentMethod: dto.method,
        paidAt: new Date().toISOString(),
      }, id).catch((err: unknown) => this.logger.error('Failed to publish invoice.paid', err));
    }

    this.logger.log(`Payment recorded for invoice ${invoice.invoiceNumber}: ${dto.amount}`);
    return updated;
  }

  async markOverdue(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.findOne(id);
    if (invoice.status !== 'SENT') {
      throw new BadRequestException(`Only SENT invoices can be marked overdue. Current: ${invoice.status}`);
    }
    const updated = await this.prisma.invoice.update({
      where: { id }, data: { status: 'OVERDUE' }, include: INVOICE_INCLUDE,
    });
    const daysOverdue = invoice.dueDate
      ? Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    this.eventPublisher.publish(ERP_TOPICS.INVOICE_OVERDUE, {
      invoiceId: id, invoiceNumber: invoice.invoiceNumber,
      contactId: invoice.contactId,
      amountDue: Number(invoice.total) - Number(invoice.amountPaid),
      currency: invoice.currency, daysOverdue,
    }, id).catch((err: unknown) => this.logger.error('Failed to publish invoice.overdue', err));
    return updated;
  }

  async cancel(id: string): Promise<InvoiceWithRelations> {
    const invoice = await this.findOne(id);
    if (invoice.status === 'PAID') throw new BadRequestException('Cannot cancel a paid invoice');
    return this.prisma.invoice.update({
      where: { id }, data: { status: 'CANCELLED' }, include: INVOICE_INCLUDE,
    });
  }

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
