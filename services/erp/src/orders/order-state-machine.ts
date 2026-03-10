export enum OrderStatus {
  PENDING = 'PENDING', CONFIRMED = 'CONFIRMED', PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED', FULFILLED = 'FULFILLED', CANCELLED = 'CANCELLED', REFUNDED = 'REFUNDED',
}

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.FULFILLED, OrderStatus.REFUNDED],
  [OrderStatus.FULFILLED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [], [OrderStatus.REFUNDED]: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from]?.includes(to) ?? false;
export const getAllowedTransitions = (from: OrderStatus) => TRANSITIONS[from] ?? [];
export const isTerminalStatus = (s: OrderStatus) => s === OrderStatus.CANCELLED || s === OrderStatus.REFUNDED;
