import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowEngineService } from '../../engine/workflow-engine.service';
import type {
  OrderCreatedPayloadDto,
  OrderUpdatedPayloadDto,
  OrderFulfilledPayloadDto,
} from '../dto/order-events.dto';

/**
 * OrderConsumerService handles all Kafka messages on the order.* topics.
 *
 * Each method is bound to its topic via @MessagePattern and delegates
 * to the WorkflowEngineService to fire matching pre-built workflow templates.
 */
@Controller()
export class OrderConsumerService {
  private readonly logger = new Logger(OrderConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly engine: WorkflowEngineService,
  ) {}

  // ---------------------------------------------------------------------------
  // order.created
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.ORDER_CREATED)
  async handleOrderCreated(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<OrderCreatedPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => OrderCreatedPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing order.created — orderId=${p.orderId} customerId=${p.customerId} total=${p.total} ${p.currency}`,
      );
      // Trigger matching pre-built workflow templates (e.g. order-to-invoice)
      const instances = await this.engine.handleEvent(
        `erp.${WORKFLOW_TOPICS.ORDER_CREATED}`,
        { payload: p },
      );
      this.logger.log(
        `order.created triggered ${instances.length} workflow instance(s)`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // order.updated
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.ORDER_UPDATED)
  async handleOrderUpdated(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<OrderUpdatedPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => OrderUpdatedPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing order.updated — orderId=${p.orderId} ${p.previousStatus} → ${p.newStatus}`,
      );
      await this.engine.handleEvent(`erp.${WORKFLOW_TOPICS.ORDER_UPDATED}`, { payload: p });
    });
  }

  // ---------------------------------------------------------------------------
  // order.fulfilled
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.ORDER_FULFILLED)
  async handleOrderFulfilled(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<OrderFulfilledPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => OrderFulfilledPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing order.fulfilled — orderId=${p.orderId} tracking=${p.trackingNumber ?? 'N/A'}`,
      );
      await this.engine.handleEvent(`erp.${WORKFLOW_TOPICS.ORDER_FULFILLED}`, { payload: p });
    });
  }
}
