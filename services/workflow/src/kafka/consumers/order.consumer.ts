import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowService } from '../../workflow/workflow.service';
import {
  OrderCreatedPayloadDto,
  OrderUpdatedPayloadDto,
  OrderFulfilledPayloadDto,
} from '../dto/order-events.dto';

/**
 * OrderConsumerService handles all Kafka messages on the order.* topics.
 *
 * Each method is bound to its topic via @MessagePattern, deserializes and
 * validates the event, then delegates to EventHandlerService which forwards
 * the payload into the WorkflowService.handleEvent() pipeline.
 */
@Controller()
export class OrderConsumerService {
  private readonly logger = new Logger(OrderConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly workflowService: WorkflowService,
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(OrderCreatedPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `order.created — orderId=${p.orderId} customerId=${p.customerId} total=${p.total} ${p.currency}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.ORDER_CREATED, p);
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(OrderUpdatedPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `order.updated — orderId=${p.orderId} ${p.previousStatus} → ${p.newStatus}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.ORDER_UPDATED, p);
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(OrderFulfilledPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `order.fulfilled — orderId=${p.orderId} tracking=${p.trackingNumber ?? 'N/A'}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.ORDER_FULFILLED, p);
    });
  }
}
