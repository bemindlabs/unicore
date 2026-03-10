import { SetMetadata } from '@nestjs/common';
import type { ErpTopic } from '../events/event-types';

export const PUBLISH_EVENT_METADATA = 'erp:publish_event';

export interface PublishEventOptions {
  /** The Kafka topic to publish to. */
  topic: ErpTopic;
  /**
   * Optional: name of the method return value property to use as the Kafka
   * partition key (e.g. 'orderId').  If omitted a random UUID is used.
   */
  keyField?: string;
}

/**
 * @PublishEvent(topic, keyField?)
 *
 * Method decorator for ERP controllers/services.  When applied, the
 * ErpEventInterceptor will automatically publish the method's return value
 * (or the resolved Promise value) to the specified Kafka topic after
 * successful execution.
 *
 * @example
 * ```ts
 * @PublishEvent(ERP_TOPICS.ORDER_CREATED, 'orderId')
 * async createOrder(@Body() dto: OrderCreatedEventDto) { ... }
 * ```
 */
export const PublishEvent = (topic: ErpTopic, keyField?: string): MethodDecorator =>
  SetMetadata<string, PublishEventOptions>(PUBLISH_EVENT_METADATA, { topic, keyField });
