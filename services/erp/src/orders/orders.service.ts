import { Injectable, Logger } from '@nestjs/common';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import type {
  OrderCreatedEventDto,
  OrderUpdatedEventDto,
  OrderFulfilledEventDto,
} from '../events/dto';

/**
 * OrdersService
 *
 * Manages order lifecycle and publishes domain events to Kafka on mutations.
 * In a full implementation this service would persist orders via Prisma; here
 * it owns the event-publishing contract so other bounded contexts can react.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly eventPublisher: EventPublisherService) {}

  /**
   * Creates an order and emits order.created.
   * Partition key = orderId to preserve ordering within a single order's events.
   */
  async createOrder(data: OrderCreatedEventDto): Promise<OrderCreatedEventDto> {
    this.logger.log(`Creating order: orderId="${data.orderId}"`);

    // TODO: persist to database via Prisma

    await this.eventPublisher.publish<OrderCreatedEventDto>(
      ERP_TOPICS.ORDER_CREATED,
      data,
      data.orderId,
    );

    return data;
  }

  /**
   * Updates an order's status and emits order.updated.
   */
  async updateOrder(data: OrderUpdatedEventDto): Promise<OrderUpdatedEventDto> {
    this.logger.log(
      `Updating order: orderId="${data.orderId}" status="${data.previousStatus}"→"${data.newStatus}"`,
    );

    // TODO: persist status change via Prisma

    await this.eventPublisher.publish<OrderUpdatedEventDto>(
      ERP_TOPICS.ORDER_UPDATED,
      data,
      data.orderId,
    );

    return data;
  }

  /**
   * Marks an order as fulfilled and emits order.fulfilled.
   */
  async fulfillOrder(data: OrderFulfilledEventDto): Promise<OrderFulfilledEventDto> {
    this.logger.log(`Fulfilling order: orderId="${data.orderId}"`);

    // TODO: persist fulfilment record via Prisma

    await this.eventPublisher.publish<OrderFulfilledEventDto>(
      ERP_TOPICS.ORDER_FULFILLED,
      data,
      data.orderId,
    );

    return data;
  }
}
