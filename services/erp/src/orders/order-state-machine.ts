/**
 * Order Fulfillment State Machine
 *
 * Valid transitions:
 *   PENDING    → CONFIRMED | CANCELLED
 *   CONFIRMED  → PROCESSING | CANCELLED
 *   PROCESSING → SHIPPED | CANCELLED
 *   SHIPPED    → FULFILLED | REFUNDED
 *   FULFILLED  → REFUNDED
 *   CANCELLED  → (terminal)
 *   REFUNDED   → (terminal)
 */

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.FULFILLED, OrderStatus.REFUNDED],
  [OrderStatus.FULFILLED]: [OrderStatus.REFUNDED],
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
  return (
    status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED
  );
}

export function isFulfillableStatus(status: OrderStatus): boolean {
  return status === OrderStatus.PROCESSING || status === OrderStatus.SHIPPED;
}
