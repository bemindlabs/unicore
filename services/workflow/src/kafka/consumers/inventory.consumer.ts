import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowEngineService } from '../../engine/workflow-engine.service';
import type {
  InventoryLowPayloadDto,
  InventoryRestockedPayloadDto,
} from '../dto/inventory-events.dto';

/**
 * InventoryConsumerService handles Kafka messages on the inventory.* topics.
 * Fires matching workflow templates (e.g. low-stock-reorder).
 */
@Controller()
export class InventoryConsumerService {
  private readonly logger = new Logger(InventoryConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly engine: WorkflowEngineService,
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
    const envelope = await deserializeEnvelope<InventoryLowPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => InventoryLowPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.warn(
        `Processing inventory.low — productId=${p.productId} sku=${p.sku} qty=${p.currentQuantity}/${p.threshold}`,
      );
      // Trigger matching pre-built workflow templates (e.g. low-stock-reorder)
      const instances = await this.engine.handleEvent(
        `erp.${WORKFLOW_TOPICS.INVENTORY_LOW}`,
        { payload: p },
      );
      this.logger.log(
        `inventory.low triggered ${instances.length} workflow instance(s)`,
      );
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
    const envelope = await deserializeEnvelope<InventoryRestockedPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => InventoryRestockedPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing inventory.restocked — productId=${p.productId} qty=${p.previousQuantity}→${p.newQuantity}`,
      );
      await this.engine.handleEvent(
        `erp.${WORKFLOW_TOPICS.INVENTORY_RESTOCKED}`,
        { payload: p },
      );
    });
  }
}
