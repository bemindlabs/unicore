/**
 * Canonical Kafka topic names for ERP domain events.
 * Topic format: <domain>.<action>
 * Kafka 7.5 — all topics must be pre-created with appropriate replication.
 */
export const ERP_TOPICS = {
  // Order domain
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_FULFILLED: 'order.fulfilled',
  // Inventory domain
  INVENTORY_LOW: 'inventory.low',
  INVENTORY_RESTOCKED: 'inventory.restocked',
  // Invoice domain
  INVOICE_CREATED: 'invoice.created',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_PAID: 'invoice.paid',
} as const;

export type ErpTopic = (typeof ERP_TOPICS)[keyof typeof ERP_TOPICS];

/** Envelope wrapping every ERP domain event published to Kafka. */
export interface ErpEventEnvelope<T = unknown> {
  /** Unique event ID (UUID v4). */
  eventId: string;
  /** ISO 8601 timestamp when the event was created. */
  occurredAt: string;
  /** Topic / event type (mirrors the Kafka topic key). */
  type: ErpTopic;
  /** Service that produced the event. */
  source: 'erp-service';
  /** Schema version — bump on breaking payload changes. */
  schemaVersion: number;
  /** Domain-specific payload. */
  payload: T;
}
