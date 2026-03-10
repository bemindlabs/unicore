import 'reflect-metadata';
import { deserializeEnvelope, deserializePayload } from '../src/kafka/utils/event-deserializer';
import { OrderCreatedPayloadDto, OrderStatus } from '../src/kafka/dto/order-events.dto';
import { InventoryLowPayloadDto } from '../src/kafka/dto/inventory-events.dto';
import { InvoiceOverduePayloadDto } from '../src/kafka/dto/invoice-events.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBuffer(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(obj), 'utf-8');
}

const validEnvelopeBase = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  occurredAt: '2026-03-10T10:00:00.000Z',
  type: 'order.created',
  source: 'erp-service',
  schemaVersion: 1,
  payload: {},
};

// ---------------------------------------------------------------------------
// deserializeEnvelope
// ---------------------------------------------------------------------------

describe('deserializeEnvelope', () => {
  it('returns null for null input', async () => {
    const result = await deserializeEnvelope(null);
    expect(result).toBeNull();
  });

  it('returns null for undefined input', async () => {
    const result = await deserializeEnvelope(undefined);
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    const result = await deserializeEnvelope('not-json{{{');
    expect(result).toBeNull();
  });

  it('returns null when required envelope fields are missing', async () => {
    const bad = { eventId: 'abc' }; // missing occurredAt, type, source, schemaVersion, payload
    const result = await deserializeEnvelope(toBuffer(bad));
    expect(result).toBeNull();
  });

  it('returns null when occurredAt is not a valid ISO date', async () => {
    const bad = { ...validEnvelopeBase, occurredAt: 'not-a-date' };
    const result = await deserializeEnvelope(toBuffer(bad));
    expect(result).toBeNull();
  });

  it('parses a valid envelope from Buffer', async () => {
    const result = await deserializeEnvelope(toBuffer(validEnvelopeBase));
    expect(result).not.toBeNull();
    expect(result!.eventId).toBe(validEnvelopeBase.eventId);
    expect(result!.type).toBe('order.created');
    expect(result!.schemaVersion).toBe(1);
  });

  it('parses a valid envelope from string', async () => {
    const result = await deserializeEnvelope(JSON.stringify(validEnvelopeBase));
    expect(result).not.toBeNull();
    expect(result!.source).toBe('erp-service');
  });
});

// ---------------------------------------------------------------------------
// deserializePayload — OrderCreatedPayloadDto
// ---------------------------------------------------------------------------

describe('deserializePayload — OrderCreatedPayloadDto', () => {
  const validOrder = {
    orderId: 'ord-001',
    customerId: 'cust-001',
    status: OrderStatus.PENDING,
    lineItems: [
      {
        productId: 'prod-001',
        productName: 'Widget',
        sku: 'WDG-001',
        quantity: 2,
        unitPrice: 10.5,
        totalPrice: 21.0,
      },
    ],
    subtotal: 21.0,
    tax: 1.47,
    total: 22.47,
    currency: 'USD',
  };

  it('deserializes a valid order.created payload', async () => {
    const result = await deserializePayload(OrderCreatedPayloadDto, validOrder);
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe('ord-001');
    expect(result!.lineItems).toHaveLength(1);
    expect(result!.total).toBe(22.47);
  });

  it('returns null when orderId is missing', async () => {
    const { orderId: _dropped, ...bad } = validOrder;
    const result = await deserializePayload(OrderCreatedPayloadDto, bad);
    expect(result).toBeNull();
  });

  it('returns null when lineItems is empty', async () => {
    const bad = { ...validOrder, lineItems: [] };
    const result = await deserializePayload(OrderCreatedPayloadDto, bad);
    expect(result).toBeNull();
  });

  it('returns null when status is not a valid enum value', async () => {
    const bad = { ...validOrder, status: 'bogus-status' };
    const result = await deserializePayload(OrderCreatedPayloadDto, bad);
    expect(result).toBeNull();
  });

  it('returns null when total is negative', async () => {
    const bad = { ...validOrder, total: -5 };
    const result = await deserializePayload(OrderCreatedPayloadDto, bad);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deserializePayload — InventoryLowPayloadDto
// ---------------------------------------------------------------------------

describe('deserializePayload — InventoryLowPayloadDto', () => {
  const validInventory = {
    productId: 'prod-001',
    productName: 'Widget',
    sku: 'WDG-001',
    currentQuantity: 3,
    threshold: 10,
    warehouseId: 'wh-001',
  };

  it('deserializes a valid inventory.low payload', async () => {
    const result = await deserializePayload(InventoryLowPayloadDto, validInventory);
    expect(result).not.toBeNull();
    expect(result!.sku).toBe('WDG-001');
    expect(result!.currentQuantity).toBe(3);
  });

  it('accepts payload without optional warehouseId', async () => {
    const { warehouseId: _dropped, ...noWarehouse } = validInventory;
    const result = await deserializePayload(InventoryLowPayloadDto, noWarehouse);
    expect(result).not.toBeNull();
    expect(result!.warehouseId).toBeUndefined();
  });

  it('returns null when productId is empty string', async () => {
    const bad = { ...validInventory, productId: '' };
    const result = await deserializePayload(InventoryLowPayloadDto, bad);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deserializePayload — InvoiceOverduePayloadDto
// ---------------------------------------------------------------------------

describe('deserializePayload — InvoiceOverduePayloadDto', () => {
  const validOverdue = {
    invoiceId: 'inv-001',
    customerId: 'cust-001',
    total: 500.0,
    currency: 'USD',
    dueDate: '2026-02-01T00:00:00.000Z',
    daysOverdue: 37,
    customerEmail: 'customer@example.com',
  };

  it('deserializes a valid invoice.overdue payload', async () => {
    const result = await deserializePayload(InvoiceOverduePayloadDto, validOverdue);
    expect(result).not.toBeNull();
    expect(result!.daysOverdue).toBe(37);
    expect(result!.invoiceId).toBe('inv-001');
  });

  it('returns null when daysOverdue is 0 (must be >= 1)', async () => {
    const bad = { ...validOverdue, daysOverdue: 0 };
    const result = await deserializePayload(InvoiceOverduePayloadDto, bad);
    expect(result).toBeNull();
  });

  it('returns null when dueDate is not a valid date string', async () => {
    const bad = { ...validOverdue, dueDate: 'sometime' };
    const result = await deserializePayload(InvoiceOverduePayloadDto, bad);
    expect(result).toBeNull();
  });
});
