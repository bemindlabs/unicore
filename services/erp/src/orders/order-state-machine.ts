/**
 * Order Fulfillment State Machine
 *
 * Valid transitions (aligned with Prisma OrderStatus enum):
 *   DRAFT                -> QUOTED | CONFIRMED | CANCELLED
 *   QUOTED               -> CONFIRMED | CANCELLED
 *   CONFIRMED            -> PROCESSING | CANCELLED
 *   PROCESSING           -> PARTIALLY_FULFILLED | FULFILLED | SHIPPED | CANCELLED
 *   PARTIALLY_FULFILLED  -> FULFILLED | SHIPPED | CANCELLED
 *   FULFILLED            -> SHIPPED | RETURNED | REFUNDED
 *   SHIPPED              -> DELIVERED | RETURNED | REFUNDED
 *   DELIVERED            -> RETURNED | REFUNDED (terminal for normal flow)
 *   RETURNED             -> REFUNDED
 *   CANCELLED            -> (terminal)
 *   REFUNDED             -> (terminal)
 */

export enum OrderStatus {
  DRAFT = 'DRAFT',
  QUOTED = 'QUOTED',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  PARTIALLY_FULFILLED = 'PARTIALLY_FULFILLED',
  FULFILLED = 'FULFILLED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.QUOTED, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.QUOTED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.PARTIALLY_FULFILLED, OrderStatus.FULFILLED, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.PARTIALLY_FULFILLED]: [OrderStatus.FULFILLED, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.FULFILLED]: [OrderStatus.SHIPPED, OrderStatus.RETURNED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED, OrderStatus.REFUNDED],
  [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED || status === OrderStatus.DELIVERED;
}
