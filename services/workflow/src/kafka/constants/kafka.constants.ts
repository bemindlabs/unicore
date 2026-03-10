/**
 * Canonical Kafka topic names consumed by the workflow service.
 * Mirrors ERP_TOPICS from the erp service (source of truth for topic names).
 */
export const WORKFLOW_TOPICS = {
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

export type WorkflowTopic = (typeof WORKFLOW_TOPICS)[keyof typeof WORKFLOW_TOPICS];

/** Default consumer group for the workflow service. */
export const WORKFLOW_CONSUMER_GROUP = 'workflow-consumer-group';

/** Injection token for KafkaJS Consumer instance. */
export const KAFKA_CONSUMER_TOKEN = Symbol('KAFKA_CONSUMER');
