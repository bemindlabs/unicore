export const ERP_TOPICS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_FULFILLED: 'order.fulfilled',
  INVENTORY_LOW: 'inventory.low',
  INVENTORY_RESTOCKED: 'inventory.restocked',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_PAID: 'invoice.paid',
} as const;

export type ErpTopic = (typeof ERP_TOPICS)[keyof typeof ERP_TOPICS];

export interface ErpEventEnvelope<T = unknown> {
  eventId: string;
  occurredAt: string;
  type: ErpTopic;
  source: 'erp-service';
  schemaVersion: number;
  payload: T;
}
