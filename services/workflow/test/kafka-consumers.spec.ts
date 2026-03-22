/**
 * Tests for Kafka consumer services (Order, Inventory, Invoice).
 *
 * We mock the deserializer utilities and the NestJS service dependencies
 * to test consumer routing and error-handling logic in isolation.
 */
import 'reflect-metadata';

// Mock the deserializer so we can control what is returned per test
jest.mock('../src/kafka/utils/event-deserializer', () => ({
  deserializeEnvelope: jest.fn(),
  deserializePayload: jest.fn(),
}));

import { OrderConsumerService } from '../src/kafka/consumers/order.consumer';
import { InventoryConsumerService } from '../src/kafka/consumers/inventory.consumer';
import { InvoiceConsumerService } from '../src/kafka/consumers/invoice.consumer';
import { EventHandlerService } from '../src/kafka/event-handler.service';
import { WorkflowService } from '../src/workflow/workflow.service';
import { deserializeEnvelope, deserializePayload } from '../src/kafka/utils/event-deserializer';
import { WORKFLOW_TOPICS } from '../src/kafka/constants/kafka.constants';

const mockDeserializeEnvelope = deserializeEnvelope as jest.Mock;
const mockDeserializePayload = deserializePayload as jest.Mock;

// Helper to create a fake KafkaContext with a specific raw value
function makeKafkaContext(value: unknown) {
  return {
    getMessage: () => ({ value }),
  } as any;
}

// Helper to build a fake envelope
function makeEnvelope(type: string, payload: unknown) {
  return {
    eventId: 'evt-test-001',
    occurredAt: '2026-03-21T10:00:00.000Z',
    type,
    source: 'erp-service',
    schemaVersion: 1,
    payload,
  };
}

// A real EventHandlerService that calls the handler directly (for integration)
function makeRealEventHandler() {
  const handler = new EventHandlerService();
  return handler;
}

function makeMockWorkflowService() {
  return { handleEvent: jest.fn().mockResolvedValue([]) } as unknown as WorkflowService;
}

function makeMockRetryService() {
  return {
    withRetry: jest.fn().mockImplementation(async (fn: () => Promise<void>) => {
      await fn();
      return { retryCount: 0, succeeded: true };
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// OrderConsumerService
// ---------------------------------------------------------------------------

describe('OrderConsumerService', () => {
  let consumer: OrderConsumerService;
  let mockWorkflowService: WorkflowService;
  let eventHandler: EventHandlerService;

  const validOrderCreatedPayload = {
    orderId: 'ORD-001',
    customerId: 'CUST-001',
    status: 'pending',
    lineItems: [{ productId: 'p1', productName: 'Widget', sku: 'SKU-1', quantity: 2, unitPrice: 10, totalPrice: 20 }],
    subtotal: 20,
    tax: 2,
    total: 22,
    currency: 'USD',
  };

  const validOrderUpdatedPayload = {
    orderId: 'ORD-001',
    customerId: 'CUST-001',
    previousStatus: 'pending',
    newStatus: 'confirmed',
  };

  const validOrderFulfilledPayload = {
    orderId: 'ORD-001',
    customerId: 'CUST-001',
    fulfilledAt: '2026-03-21T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkflowService = makeMockWorkflowService();
    eventHandler = makeRealEventHandler();
    consumer = new OrderConsumerService(eventHandler, mockWorkflowService);
  });

  describe('handleOrderCreated', () => {
    it('calls workflowService.handleEvent with ORDER_CREATED topic on valid message', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_CREATED, validOrderCreatedPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validOrderCreatedPayload);

      await consumer.handleOrderCreated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.ORDER_CREATED,
        validOrderCreatedPayload,
      );
    });

    it('returns early without calling handleEvent when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleOrderCreated(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early without calling handleEvent when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_CREATED, {});
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleOrderCreated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('passes the raw message value to deserializeEnvelope', async () => {
      const rawValue = Buffer.from('{"test": true}');
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleOrderCreated(null, makeKafkaContext(rawValue));

      expect(mockDeserializeEnvelope).toHaveBeenCalledWith(rawValue);
    });
  });

  describe('handleOrderUpdated', () => {
    it('calls workflowService.handleEvent with ORDER_UPDATED topic on valid message', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_UPDATED, validOrderUpdatedPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validOrderUpdatedPayload);

      await consumer.handleOrderUpdated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.ORDER_UPDATED,
        validOrderUpdatedPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleOrderUpdated(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_UPDATED, {});
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleOrderUpdated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleOrderFulfilled', () => {
    it('calls workflowService.handleEvent with ORDER_FULFILLED topic on valid message', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_FULFILLED, validOrderFulfilledPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validOrderFulfilledPayload);

      await consumer.handleOrderFulfilled(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.ORDER_FULFILLED,
        validOrderFulfilledPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleOrderFulfilled(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('handles optional tracking number in fulfilled payload', async () => {
      const payloadWithTracking = { ...validOrderFulfilledPayload, trackingNumber: 'TRACK-999', carrier: 'FedEx' };
      const envelope = makeEnvelope(WORKFLOW_TOPICS.ORDER_FULFILLED, payloadWithTracking);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(payloadWithTracking);

      await consumer.handleOrderFulfilled(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.ORDER_FULFILLED,
        payloadWithTracking,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// InventoryConsumerService
// ---------------------------------------------------------------------------

describe('InventoryConsumerService', () => {
  let consumer: InventoryConsumerService;
  let mockWorkflowService: WorkflowService;
  let eventHandler: EventHandlerService;

  const validInventoryLowPayload = {
    productId: 'PROD-001',
    productName: 'Widget A',
    sku: 'WID-A',
    currentQuantity: 5,
    threshold: 10,
    warehouseId: 'WH-001',
  };

  const validInventoryRestockedPayload = {
    productId: 'PROD-001',
    productName: 'Widget A',
    sku: 'WID-A',
    previousQuantity: 5,
    quantityAdded: 50,
    newQuantity: 55,
    warehouseId: 'WH-001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkflowService = makeMockWorkflowService();
    eventHandler = makeRealEventHandler();
    consumer = new InventoryConsumerService(eventHandler, mockWorkflowService);
  });

  describe('handleInventoryLow', () => {
    it('calls workflowService.handleEvent with INVENTORY_LOW topic', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVENTORY_LOW, validInventoryLowPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validInventoryLowPayload);

      await consumer.handleInventoryLow(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVENTORY_LOW,
        validInventoryLowPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleInventoryLow(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVENTORY_LOW, { productId: 'PROD-001' });
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleInventoryLow(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleInventoryRestocked', () => {
    it('calls workflowService.handleEvent with INVENTORY_RESTOCKED topic', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVENTORY_RESTOCKED, validInventoryRestockedPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validInventoryRestockedPayload);

      await consumer.handleInventoryRestocked(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVENTORY_RESTOCKED,
        validInventoryRestockedPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleInventoryRestocked(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVENTORY_RESTOCKED, {});
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleInventoryRestocked(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// InvoiceConsumerService
// ---------------------------------------------------------------------------

describe('InvoiceConsumerService', () => {
  let consumer: InvoiceConsumerService;
  let mockWorkflowService: WorkflowService;
  let eventHandler: EventHandlerService;

  const validInvoiceCreatedPayload = {
    invoiceId: 'INV-001',
    customerId: 'CUST-001',
    status: 'sent',
    amount: 1000,
    tax: 100,
    total: 1100,
    currency: 'USD',
    dueDate: '2026-04-01',
    issuedAt: '2026-03-21T10:00:00.000Z',
  };

  const validInvoiceOverduePayload = {
    invoiceId: 'INV-001',
    customerId: 'CUST-001',
    total: 1100,
    currency: 'USD',
    dueDate: '2026-03-01',
    daysOverdue: 20,
  };

  const validInvoicePaidPayload = {
    invoiceId: 'INV-001',
    customerId: 'CUST-001',
    amountPaid: 1100,
    currency: 'USD',
    paidAt: '2026-03-21T14:00:00.000Z',
    paymentMethod: 'credit_card',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkflowService = makeMockWorkflowService();
    eventHandler = makeRealEventHandler();
    consumer = new InvoiceConsumerService(eventHandler, mockWorkflowService);
  });

  describe('handleInvoiceCreated', () => {
    it('calls workflowService.handleEvent with INVOICE_CREATED topic', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_CREATED, validInvoiceCreatedPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validInvoiceCreatedPayload);

      await consumer.handleInvoiceCreated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVOICE_CREATED,
        validInvoiceCreatedPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleInvoiceCreated(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_CREATED, { invoiceId: 'INV-001' });
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleInvoiceCreated(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoiceOverdue', () => {
    it('calls workflowService.handleEvent with INVOICE_OVERDUE topic', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_OVERDUE, validInvoiceOverduePayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validInvoiceOverduePayload);

      await consumer.handleInvoiceOverdue(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVOICE_OVERDUE,
        validInvoiceOverduePayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleInvoiceOverdue(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_OVERDUE, {});
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleInvoiceOverdue(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });
  });

  describe('handleInvoicePaid', () => {
    it('calls workflowService.handleEvent with INVOICE_PAID topic', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_PAID, validInvoicePaidPayload);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(validInvoicePaidPayload);

      await consumer.handleInvoicePaid(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVOICE_PAID,
        validInvoicePaidPayload,
      );
    });

    it('returns early when envelope is null', async () => {
      mockDeserializeEnvelope.mockResolvedValue(null);

      await consumer.handleInvoicePaid(null, makeKafkaContext(null));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('returns early when payload validation fails', async () => {
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_PAID, {});
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(null);

      await consumer.handleInvoicePaid(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).not.toHaveBeenCalled();
    });

    it('handles optional paymentMethod and transactionId fields', async () => {
      const payloadNoMethod = {
        invoiceId: 'INV-002',
        customerId: 'CUST-002',
        amountPaid: 500,
        currency: 'THB',
        paidAt: '2026-03-21T15:00:00.000Z',
      };
      const envelope = makeEnvelope(WORKFLOW_TOPICS.INVOICE_PAID, payloadNoMethod);
      mockDeserializeEnvelope.mockResolvedValue(envelope);
      mockDeserializePayload.mockResolvedValue(payloadNoMethod);

      await consumer.handleInvoicePaid(null, makeKafkaContext(Buffer.from('{}')));

      expect(mockWorkflowService.handleEvent).toHaveBeenCalledWith(
        WORKFLOW_TOPICS.INVOICE_PAID,
        payloadNoMethod,
      );
    });
  });
});
