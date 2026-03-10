import { canTransition, getAllowedTransitions, isTerminalStatus, OrderStatus } from './order-state-machine';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    it('allows PENDING -> CONFIRMED', () => expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true));
    it('allows PENDING -> CANCELLED', () => expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true));
    it('allows CONFIRMED -> PROCESSING', () => expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true));
    it('allows PROCESSING -> SHIPPED', () => expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true));
    it('allows SHIPPED -> FULFILLED', () => expect(canTransition(OrderStatus.SHIPPED, OrderStatus.FULFILLED)).toBe(true));
    it('allows SHIPPED -> REFUNDED', () => expect(canTransition(OrderStatus.SHIPPED, OrderStatus.REFUNDED)).toBe(true));
    it('disallows PENDING -> FULFILLED', () => expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toBe(false));
    it('disallows FULFILLED -> CONFIRMED', () => expect(canTransition(OrderStatus.FULFILLED, OrderStatus.CONFIRMED)).toBe(false));
    it('disallows CANCELLED -> anything', () => {
      for (const s of Object.values(OrderStatus)) {
        expect(canTransition(OrderStatus.CANCELLED, s as OrderStatus)).toBe(false);
      }
    });
  });

  describe('isTerminalStatus', () => {
    it('marks CANCELLED as terminal', () => expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true));
    it('marks REFUNDED as terminal', () => expect(isTerminalStatus(OrderStatus.REFUNDED)).toBe(true));
    it('does not mark FULFILLED as terminal', () => expect(isTerminalStatus(OrderStatus.FULFILLED)).toBe(false));
    it('does not mark PENDING as terminal', () => expect(isTerminalStatus(OrderStatus.PENDING)).toBe(false));
  });

  describe('getAllowedTransitions', () => {
    it('returns [CONFIRMED, CANCELLED] for PENDING', () => {
      expect(getAllowedTransitions(OrderStatus.PENDING)).toEqual([OrderStatus.CONFIRMED, OrderStatus.CANCELLED]);
    });
    it('returns [] for CANCELLED', () => expect(getAllowedTransitions(OrderStatus.CANCELLED)).toEqual([]));
  });
});
