import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { WORKFLOW_TOPICS } from '../constants/kafka.constants';
import { deserializeEnvelope, deserializePayload } from '../utils/event-deserializer';
import { EventHandlerService } from '../event-handler.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { RetryService } from '../retry/retry.service';
import {
  InvoiceCreatedPayloadDto,
  InvoiceOverduePayloadDto,
  InvoicePaidPayloadDto,
} from '../dto/invoice-events.dto';

/**
 * InvoiceConsumerService handles Kafka messages on the invoice.* topics
 * and forwards validated payloads into the workflow engine via RetryService.
 */
@Controller()
export class InvoiceConsumerService {
  private readonly logger = new Logger(InvoiceConsumerService.name);

  constructor(
    private readonly eventHandler: EventHandlerService,
    private readonly workflowService: WorkflowService,
    private readonly retryService: RetryService,
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(InvoiceCreatedPayloadDto, envelope.payload);
    if (!payload) return;

    await this.retryService.withRetry(
      async () => {
        await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
          this.logger.log(
            `invoice.created — invoiceId=${p.invoiceId} total=${p.total} ${p.currency} due=${p.dueDate}`,
          );
          await this.workflowService.handleEvent(WORKFLOW_TOPICS.INVOICE_CREATED, p);
        });
      },
      { topic: WORKFLOW_TOPICS.INVOICE_CREATED, eventId: envelope.eventId, originalPayload: payload },
    );
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(InvoiceOverduePayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.warn(
        `invoice.overdue — invoiceId=${p.invoiceId} daysOverdue=${p.daysOverdue} total=${p.total} ${p.currency}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.INVOICE_OVERDUE, p);
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
    const envelope = await deserializeEnvelope(raw as Buffer | string | null);
    if (!envelope) return;

    const payload = await deserializePayload(InvoicePaidPayloadDto, envelope.payload);
    if (!payload) return;

    await this.eventHandler.handle({ ...envelope, payload }, async (p) => {
      this.logger.log(
        `invoice.paid — invoiceId=${p.invoiceId} amountPaid=${p.amountPaid} ${p.currency} via ${p.paymentMethod ?? 'unknown'}`,
      );
      await this.workflowService.handleEvent(WORKFLOW_TOPICS.INVOICE_PAID, p);
    });
  }
}
