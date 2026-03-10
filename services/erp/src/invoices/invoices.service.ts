import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { paginate } from '../common/dto/pagination.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { Prisma, InvoiceStatus } from '@prisma/client';

let invoiceCounter = 1000;

const INVOICE_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true, email: true, company: true } },
  order: { select: { id: true, orderNumber: true } },
  lineItems: true,
  payments: { orderBy: { paidAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisherService,
  ) {}

  private generateInvoiceNumber(): string {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `INV-${yymm}-${String(++invoiceCounter).padStart(4, '0')}`;
  }

  async findAll(query: QueryInvoicesDto) {
    const { page = 1, limit = 20, search, contactId, orderId, status } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.InvoiceWhereInput = {};
    if (contactId) where.contactId = contactId;
    if (orderId) where.orderId = orderId;
    if (status) where.status = status as InvoiceStatus;
    if (search) where.invoiceNumber = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, skip, take: limit, include: INVOICE_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  async create(dto: CreateInvoiceDto) {
    const subtotal = dto.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxRate = dto.taxRate ?? 0;
    const taxAmount = subtotal * taxRate;
    const discount = dto.discount ?? 0;
    const total = subtotal + taxAmount - discount;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber: this.generateInvoiceNumber(),
        contactId: dto.contactId,
        orderId: dto.orderId,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total,
        currency: dto.currency ?? 'USD',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        lineItems: {
          create: dto.lineItems.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: INVOICE_INCLUDE,
    });

    this.events.publish(ERP_TOPICS.INVOICE_CREATED, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      contactId: invoice.contactId,
      total: Number(invoice.total),
      currency: invoice.currency,
      dueDate: invoice.dueDate?.toISOString(),
    }, invoice.id).catch(err => this.logger.error('Failed to publish invoice.created event', err));

    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be updated');
    }
    return this.prisma.invoice.update({ where: { id }, data: dto as Prisma.InvoiceUpdateInput, include: INVOICE_INCLUDE });
  }

  async send(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be sent');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT, issuedAt: new Date() },
      include: INVOICE_INCLUDE,
    });
  }

  async recordPayment(id: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(id);
    if ([InvoiceStatus.PAID, InvoiceStatus.CANCELLED].includes(invoice.status)) {
      throw new BadRequestException(`Cannot record payment on ${invoice.status} invoice`);
    }

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const isPaid = newAmountPaid >= Number(invoice.total);

    const [updated] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.SENT,
          paidAt: isPaid ? new Date() : undefined,
        },
        include: INVOICE_INCLUDE,
      }),
      this.prisma.payment.create({
        data: {
          invoiceId: id,
          amount: dto.amount,
          currency: dto.currency ?? invoice.currency,
          method: dto.method as any ?? 'BANK_TRANSFER',
          reference: dto.reference,
          notes: dto.notes,
        },
      }),
    ]);

    if (isPaid) {
      this.events.publish(ERP_TOPICS.INVOICE_PAID, {
        invoiceId: id,
        invoiceNumber: invoice.invoiceNumber,
        contactId: invoice.contactId,
        total: Number(invoice.total),
        amountPaid: newAmountPaid,
        currency: invoice.currency,
      }, id).catch(err => this.logger.error('Failed to publish invoice.paid event', err));
    }

    return updated;
  }

  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      include: INVOICE_INCLUDE,
    });
  }

  async remove(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    }
    await this.prisma.invoice.delete({ where: { id } });
  }

  async markOverdue() {
    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: { status: InvoiceStatus.SENT, dueDate: { lt: now } },
      data: { status: InvoiceStatus.OVERDUE },
    });
    return { updated: result.count };
  }
}
