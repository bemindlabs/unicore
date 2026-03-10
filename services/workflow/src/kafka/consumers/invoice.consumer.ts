import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowEngineService } from '../../engine/workflow-engine.service';
import type {
  InvoiceCreatedPayloadDto,
  InvoiceOverduePayloadDto,
  InvoicePaidPayloadDto,
} from '../dto/invoice-events.dto';

/**
 * InvoiceConsumerService handles Kafka messages on the invoice.* topics.
 * Fires matching workflow templates (e.g. invoice-overdue-reminder).
 */
@Controller()
export class InvoiceConsumerService {
  private readonly logger = new Logger(InvoiceConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly engine: WorkflowEngineService,
  ) {}

  // ---------------------------------------------------------------------------
  // invoice.created
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.INVOICE_CREATED)
  async handleInvoiceCreated(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<InvoiceCreatedPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => InvoiceCreatedPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing invoice.created — invoiceId=${p.invoiceId} total=${p.total} ${p.currency} due=${p.dueDate}`,
      );
      await this.engine.handleEvent(`erp.${WORKFLOW_TOPICS.INVOICE_CREATED}`, { payload: p });
    });
  }

  // ---------------------------------------------------------------------------
  // invoice.overdue
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.INVOICE_OVERDUE)
  async handleInvoiceOverdue(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<InvoiceOverduePayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => InvoiceOverduePayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.warn(
        `Processing invoice.overdue — invoiceId=${p.invoiceId} daysOverdue=${p.daysOverdue} total=${p.total} ${p.currency}`,
      );
      // Trigger matching pre-built workflow templates (e.g. invoice-overdue-reminder)
      const instances = await this.engine.handleEvent(
        `erp.${WORKFLOW_TOPICS.INVOICE_OVERDUE}`,
        { payload: p },
      );
      this.logger.log(
        `invoice.overdue triggered ${instances.length} workflow instance(s)`,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // invoice.paid
  // ---------------------------------------------------------------------------

  @MessagePattern(WORKFLOW_TOPICS.INVOICE_PAID)
  async handleInvoicePaid(
    @Payload() _message: unknown,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    const raw = context.getMessage().value;
    const envelope = await deserializeEnvelope<InvoicePaidPayloadDto>(
      raw as Buffer | string | null,
    );
    if (!envelope) return;

    const payload = await deserializePayload(
      class {} as new () => InvoicePaidPayloadDto,
      envelope.payload,
    );
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `Processing invoice.paid — invoiceId=${p.invoiceId} amountPaid=${p.amountPaid} ${p.currency} via ${p.paymentMethod ?? 'unknown'}`,
      );
      await this.engine.handleEvent(`erp.${WORKFLOW_TOPICS.INVOICE_PAID}`, { payload: p });
    });
  }
}
