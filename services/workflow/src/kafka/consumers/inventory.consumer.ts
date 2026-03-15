import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { InventoryLowPayloadDto, InventoryRestockedPayloadDto } from '../dto/inventory-events.dto';

/**
 * InventoryConsumerService handles Kafka messages on the inventory.* topics
 * and forwards validated payloads into the workflow engine.
 */
@Controller()
export class InventoryConsumerService {
  private readonly logger = new Logger(InventoryConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly workflowService: WorkflowService,
  ) {}

  // ---------------------------------------------------------------------------
  // inventory.low
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.INVENTORY_LOW)
  async handleInventoryLow(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(InventoryLowPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `inventory.low — sku=${p.sku} qty=${p.currentQuantity}/${p.threshold} warehouse=${p.warehouseId ?? 'default'}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.INVENTORY_LOW, p);
    });
  }

  // ---------------------------------------------------------------------------
  // inventory.restocked
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.INVENTORY_RESTOCKED)
  async handleInventoryRestocked(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(InventoryRestockedPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `inventory.restocked — sku=${p.sku} +${p.quantityAdded} → ${p.newQuantity}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.INVENTORY_RESTOCKED, p);
    });
  }
}
