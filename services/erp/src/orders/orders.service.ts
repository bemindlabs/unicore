import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { OrderStatus as PrismaOrderStatus } from '../generated/prisma';
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
  contact: { select: { id: true, name: true, email: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true } } } },
};

type OrderWithRelations = any;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderWithRelations> {
    const contact = await this.prisma.contact.findUnique({ where: { id: dto.contactId } });
    if (!contact) throw new NotFoundException(`Contact ${dto.contactId} not found`);

    const productIds = dto.lineItems.map((li) => li.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const li of dto.lineItems) {
      if (!productMap.has(li.productId)) throw new NotFoundException(`Product ${li.productId} not found`);
    }

    const lineItemsData = dto.lineItems.map((li) => {
      const product = productMap.get(li.productId)!;
      const unitPrice = li.unitPrice ?? Number(product.unitPrice);
      const lineTotal = unitPrice * li.quantity;
      return {
        product: { connect: { id: li.productId } },
        sku: product.sku,
        name: product.name,
        quantity: li.quantity,
        unitPrice,
        lineTotal,
      };
    });

    const subtotal = lineItemsData.reduce((sum, li) => sum + Number(li.lineTotal), 0);
    const taxRate = dto.taxRate ?? 0;
    const taxAmount = subtotal * taxRate;
    const discount = dto.discount ?? 0;
    const total = subtotal + taxAmount - discount;
    const orderNumber = await this.generateOrderNumber();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        contact: { connect: { id: dto.contactId } },
        status: 'DRAFT' as PrismaOrderStatus,
        items: { create: lineItemsData },
        subtotal, taxAmount, discountAmount: discount, total,
        currency: dto.currency ?? 'USD',
        notes: dto.notes,
        shippingAddress: dto.shippingAddress,
        createdById: '00000000-0000-0000-0000-000000000000',
      },
      include: ORDER_INCLUDE,
    });

    this.eventPublisher.publish(ERP_TOPICS.ORDER_CREATED, {
      orderId: order.id,
      customerId: dto.contactId,
      customerEmail: contact.email ?? undefined,
      status: 'draft',
      lineItems: order.items.map((li: any) => ({
        productId: li.productId, productName: li.name, sku: li.sku,
        quantity: li.quantity, unitPrice: Number(li.unitPrice), lineTotal: Number(li.lineTotal),
      })),
      subtotal, tax: taxAmount, total, currency: order.currency,
    }, order.id).catch((err: unknown) => this.logger.error('Failed to publish order.created', err));

    this.logger.log(`Order created: ${order.orderNumber}`);
    return order;
  }

  async findAll(query: QueryOrdersDto): Promise<PaginatedResult<OrderWithRelations>> {
    const { page = 1, limit = 20, status, contactId, search } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      ...(status && { status: status as unknown as PrismaOrderStatus }),
      ...(contactId && { contactId }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { contact: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: ORDER_INCLUDE }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderWithRelations> {
    const order = await this.findOne(id);
    const status = order.status as OrderStatus;
    if (status === OrderStatus.CANCELLED || status === OrderStatus.FULFILLED) {
      throw new BadRequestException(`Cannot update a ${status.toLowerCase()} order`);
    }
    return this.prisma.order.update({ where: { id }, data: dto, include: ORDER_INCLUDE });
  }

  async transition(id: string, toStatus: OrderStatus): Promise<OrderWithRelations> {
    const order = await this.findOne(id);
    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, toStatus)) {
      const allowed = getAllowedTransitions(fromStatus);
      throw new BadRequestException(
        `Cannot transition from ${fromStatus} to ${toStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }
    const updated = await this.prisma.order.update({ where: { id }, data: { status: toStatus as unknown as PrismaOrderStatus }, include: ORDER_INCLUDE });
    this.eventPublisher.publish(ERP_TOPICS.ORDER_UPDATED, {
      orderId: id, customerId: order.contact.id, previousStatus: fromStatus, newStatus: toStatus,
    }, id).catch((err: unknown) => this.logger.error('Failed to publish order.updated', err));
    return updated;
  }

  async confirm(id: string): Promise<OrderWithRelations> { return this.transition(id, OrderStatus.CONFIRMED); }
  async startProcessing(id: string): Promise<OrderWithRelations> { return this.transition(id, OrderStatus.PROCESSING); }

  async ship(id: string, dto: ShipOrderDto): Promise<OrderWithRelations> {
    const order = await this.findOne(id);
    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, OrderStatus.SHIPPED)) {
      throw new BadRequestException(`Cannot ship order in status ${fromStatus}`);
    }
    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.SHIPPED as unknown as PrismaOrderStatus,
        ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }),
        ...(dto.carrier && { shippingCarrier: dto.carrier }),
      },
      include: ORDER_INCLUDE,
    });
  }

  async fulfill(id: string, dto: FulfillOrderDto): Promise<OrderWithRelations> {
    const order = await this.findOne(id);
    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, OrderStatus.FULFILLED)) {
      throw new BadRequestException(`Cannot fulfill order in status ${fromStatus}`);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const inventoryItem = await tx.inventoryItem.findFirst({ where: { productId: item.productId } });
        if (!inventoryItem) continue;
        const newQty = inventoryItem.quantityOnHand - item.quantity;
        if (newQty < 0) throw new BadRequestException(`Insufficient stock for product ${item.sku}`);
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: { quantityOnHand: newQty, quantityAvailable: newQty - inventoryItem.quantityReserved },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: inventoryItem.warehouseId,
            type: 'SALE',
            quantity: -item.quantity,
            balanceAfter: newQty,
            note: 'order_fulfillment',
            referenceId: id,
            createdById: '00000000-0000-0000-0000-000000000000',
          },
        });
      }
    });

    const now = new Date();
    const fulfilled = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.FULFILLED as unknown as PrismaOrderStatus,
        deliveredAt: now,
        ...(dto.trackingNumber && { trackingNumber: dto.trackingNumber }),
        ...(dto.carrier && { shippingCarrier: dto.carrier }),
        ...(dto.notes && { notes: dto.notes }),
      },
      include: ORDER_INCLUDE,
    });

    this.eventPublisher.publish(ERP_TOPICS.ORDER_FULFILLED, {
      orderId: id, customerId: order.contact?.id,
      trackingNumber: dto.trackingNumber, carrier: dto.carrier,
      fulfilledAt: now.toISOString(),
    }, id).catch((err: unknown) => this.logger.error('Failed to publish order.fulfilled', err));

    this.logger.log(`Order fulfilled: ${order.orderNumber}`);
    return fulfilled;
  }

  async cancel(id: string, dto: CancelOrderDto): Promise<OrderWithRelations> {
    const order = await this.findOne(id);
    const fromStatus = order.status as OrderStatus;
    if (!canTransition(fromStatus, OrderStatus.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel order in status ${fromStatus}`);
    }
    return this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED as unknown as PrismaOrderStatus,
        cancelledAt: new Date(),
        ...(dto.reason && { notes: dto.reason }),
      },
      include: ORDER_INCLUDE,
    });
  }

  async refund(id: string): Promise<OrderWithRelations> { return this.transition(id, OrderStatus.REFUNDED); }

  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    return `ORD-${String(count + 1).padStart(6, '0')}`;
  }
}
