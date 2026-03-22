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

  // Chat domain — enables audit trail, event replay, and cross-service correlation
  CHAT_MESSAGE_INBOUND: 'chat.message.inbound',
  CHAT_MESSAGE_OUTBOUND: 'chat.message.outbound',
  CHAT_MESSAGE_ACK: 'chat.message.ack',
  CHAT_CONVERSATION_CREATED: 'chat.conversation.created',
  CHAT_CONVERSATION_CLOSED: 'chat.conversation.closed',
} as const;

export type WorkflowTopic = (typeof WORKFLOW_TOPICS)[keyof typeof WORKFLOW_TOPICS];

/** Default consumer group for the workflow service. */
export const WORKFLOW_CONSUMER_GROUP = 'workflow-consumer-group';

/** Injection token for KafkaJS Consumer instance. */
export const KAFKA_CONSUMER_TOKEN = Symbol('KAFKA_CONSUMER');

/**
 * Dead Letter Queue (DLQ) topic names for failed events.
 * Messages that exhaust all retry attempts are published here.
 */
export const DLQ_TOPICS = {
  ORDER: 'dlq.order',
  INVENTORY: 'dlq.inventory',
  INVOICE: 'dlq.invoice',
  CHAT: 'dlq.chat',
} as const;

export type DlqTopic = (typeof DLQ_TOPICS)[keyof typeof DLQ_TOPICS];

/** Maps a source topic prefix to its corresponding DLQ topic. */
const TOPIC_PREFIX_TO_DLQ: Array<[string, DlqTopic]> = [
  ['order.', DLQ_TOPICS.ORDER],
  ['inventory.', DLQ_TOPICS.INVENTORY],
  ['invoice.', DLQ_TOPICS.INVOICE],
  ['chat.', DLQ_TOPICS.CHAT],
];

/**
 * Returns the DLQ topic for a given source topic.
 * Falls back to dlq.order if no prefix matches.
 */
export function getDlqTopic(topic: string): DlqTopic {
  for (const [prefix, dlq] of TOPIC_PREFIX_TO_DLQ) {
    if (topic.startsWith(prefix)) return dlq;
  }
  return DLQ_TOPICS.ORDER;
}
