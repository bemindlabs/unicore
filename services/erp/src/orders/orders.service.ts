import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';
import { OrderStatus, canTransition, getAllowedTransitions } from './order-state-machine';

const ORDER_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  lineItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(private readonly prisma: PrismaService, private readonly eventPublisher: EventPublisherService) {}

  async create(dto: CreateOrderDto): Promise<OrderWithRelations> {
    const contact = await this.prisma.contact.findUnique({ where: { id: dto.contactId } });
    if (!contact) throw new NotFoundException(`Contact ${dto.contactId} not found`);
    const products = await this.prisma.product.findMany({ where: { id: { in: dto.lineItems.map(li => li.productId) } } });
    const pm = new Map(products.map(p => [p.id, p]));
    for (const li of dto.lineItems) if (!pm.has(li.productId)) throw new NotFoundException(`Product ${li.productId} not found`);

    const lineItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = dto.lineItems.map(li => {
      const p = pm.get(li.productId)!;
      const unitPrice = li.unitPrice ?? Number(p.unitPrice);
      return { product: { connect: { id: li.productId } }, sku: p.sku, productName: p.name, quantity: li.quantity, unitPrice, totalPrice: unitPrice * li.quantity };
    });

    const subtotal = lineItemsData.reduce((s, li) => s + Number(li.totalPrice), 0);
    const taxRate = dto.taxRate ?? 0; const taxAmount = subtotal * taxRate;
    const discount = dto.discount ?? 0; const total = subtotal + taxAmount - discount;
    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.order.create({
      data: {
        orderNumber, contact: { connect: { id: dto.contactId } }, status: OrderStatus.PENDING,
        lineItems: { create: lineItemsData }, subtotal, taxRate, taxAmount, discount, total,
        currency: dto.currency ?? 'USD', notes: dto.notes, shippingAddress: dto.shippingAddress,
      },
      include: ORDER_INCLUDE,
    });

    this.eventPublisher.publish(ERP_TOPICS.ORDER_CREATED, {
      orderId: order.id, customerId: dto.contactId, customerEmail: contact.email ?? undefined, status: 'pending',
      lineItems: order.lineItems.map(li => ({ productId: li.productId, productName: li.productName, sku: li.sku, quantity: li.quantity, unitPrice: Number(li.unitPrice), totalPrice: Number(li.totalPrice) })),
      subtotal, tax: taxAmount, total, currency: order.currency,
    }, order.id).catch((err: unknown) => this.logger.error('order.created publish failed', err));
    this.logger.log(`Order created: ${order.orderNumber}`);
    return order;
  }

  async findAll(q: QueryOrdersDto): Promise<PaginatedResult<OrderWithRelations>> {
    const { page = 1, limit = 20, status, contactId, search } = q;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {
      ...(status && { status }), ...(contactId && { contactId }),
      ...(search && { OR: [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { contact: { firstName: { contains: search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: search, mode: 'insensitive' } } },
      ]}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: ORDER_INCLUDE }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<OrderWithRelations> {
    const o = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException(`Order ${id} not found`);
    return o;
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderWithRelations> {
    const o = await this.findOne(id);
    if (o.status === OrderStatus.CANCELLED || o.status === OrderStatus.FULFILLED)
      throw new BadRequestException(`Cannot update a ${o.status.toLowerCase()} order`);
    return this.prisma.order.update({ where: { id }, data: dto, include: ORDER_INCLUDE });
  }

  async transition(id: string, to: OrderStatus): Promise<OrderWithRelations> {
    const o = await this.findOne(id);
    const from = o.status as OrderStatus;
    if (!canTransition(from, to)) {
      const allowed = getAllowedTransitions(from);
      throw new BadRequestException(`Cannot transition ${from} -> ${to}. Allowed: ${allowed.join(', ') || 'none'}`);
    }
    const updated = await this.prisma.order.update({ where: { id }, data: { status: to }, include: ORDER_INCLUDE });
    this.eventPublisher.publish(ERP_TOPICS.ORDER_UPDATED, { orderId: id, customerId: o.contact.id, previousStatus: from, newStatus: to }, id)
      .catch((err: unknown) => this.logger.error('order.updated publish failed', err));
    return updated;
  }

  async confirm(id: string) { return this.transition(id, OrderStatus.CONFIRMED); }
  async startProcessing(id: string) { return this.transition(id, OrderStatus.PROCESSING); }

  async ship(id: string, dto: ShipOrderDto): Promise<OrderWithRelations> {
    const o = await this.findOne(id);
    if (!canTransition(o.status as OrderStatus, OrderStatus.SHIPPED))
      throw new BadRequestException(`Cannot ship order in status ${o.status}`);
    return this.prisma.order.update({
      where: { id }, include: ORDER_INCLUDE,
      data: { status: OrderStatus.SHIPPED, ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }), ...(dto.carrier && { carrier: dto.carrier }) },
    });
  }

  async fulfill(id: string, dto: FulfillOrderDto): Promise<OrderWithRelations> {
    const o = await this.findOne(id);
    if (!canTransition(o.status as OrderStatus, OrderStatus.FULFILLED))
      throw new BadRequestException(`Cannot fulfill order in status ${o.status}`);

    await this.prisma.$transaction(async tx => {
      for (const item of o.lineItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        const newQty = product.quantity - item.quantity;
        if (newQty < 0) throw new BadRequestException(`Insufficient stock for ${product.sku}`);
        await tx.product.update({ where: { id: item.productId }, data: { quantity: newQty } });
        await tx.stockMovement.create({ data: { productId: item.productId, delta: -item.quantity, reason: 'order_fulfillment', referenceId: id, quantityBefore: product.quantity, quantityAfter: newQty } });
      }
    });

    const now = new Date();
    const fulfilled = await this.prisma.order.update({
      where: { id }, include: ORDER_INCLUDE,
      data: { status: OrderStatus.FULFILLED, fulfilledAt: now, ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }), ...(dto.carrier && { carrier: dto.carrier }), ...(dto.notes && { notes: dto.notes }) },
    });

    this.eventPublisher.publish(ERP_TOPICS.ORDER_FULFILLED, { orderId: id, customerId: o.contact.id, trackingNumber: dto.trackingNumber, carrier: dto.carrier, fulfilledAt: now.toISOString() }, id)
      .catch((err: unknown) => this.logger.error('order.fulfilled publish failed', err));
    this.logger.log(`Order fulfilled: ${o.orderNumber}`);
    return fulfilled;
  }

  async cancel(id: string, dto: CancelOrderDto): Promise<OrderWithRelations> {
    const o = await this.findOne(id);
    if (!canTransition(o.status as OrderStatus, OrderStatus.CANCELLED))
      throw new BadRequestException(`Cannot cancel order in status ${o.status}`);
    return this.prisma.order.update({
      where: { id }, include: ORDER_INCLUDE,
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), ...(dto.reason && { notes: dto.reason }) },
    });
  }

  async refund(id: string) { return this.transition(id, OrderStatus.REFUNDED); }

  private async generateOrderNumber(): Promise<string> {
    return `ORD-${String(await this.prisma.order.count() + 1).padStart(6, '0')}`;
  }
}
