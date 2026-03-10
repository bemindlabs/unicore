import { Injectable, Logger } from '@nestjs/common';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import type { InventoryLowEventDto, InventoryRestockedEventDto } from '../events/dto';

/**
 * InventoryService
 *
 * Manages product stock levels and emits Kafka events when thresholds are
 * breached or stock is replenished.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly eventPublisher: EventPublisherService) {}

  /**
   * Emits inventory.low when current stock falls at or below the configured
   * threshold.  Callers (e.g. a scheduled job or post-order hook) are
   * responsible for evaluating the threshold before calling this method.
   */
  async notifyLowStock(data: InventoryLowEventDto): Promise<void> {
    this.logger.warn(
      `Low stock alert: sku="${data.sku}" current=${data.currentQuantity} threshold=${data.threshold}`,
    );

    await this.eventPublisher.publish<InventoryLowEventDto>(
      ERP_TOPICS.INVENTORY_LOW,
      data,
      data.productId,
    );
  }

  /**
   * Emits inventory.restocked after a purchase order is received and stock
   * levels are updated.
   */
  async notifyRestocked(data: InventoryRestockedEventDto): Promise<void> {
    this.logger.log(
      `Stock restocked: sku="${data.sku}" added=${data.quantityAdded} new total=${data.newQuantity}`,
    );

    await this.eventPublisher.publish<InventoryRestockedEventDto>(
      ERP_TOPICS.INVENTORY_RESTOCKED,
      data,
      data.productId,
    );
  }
}
