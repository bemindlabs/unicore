import { canTransition, getAllowedTransitions, isTerminalStatus, OrderStatus } from './order-state-machine';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    it('allows DRAFT -> CONFIRMED', () => expect(canTransition(OrderStatus.DRAFT, OrderStatus.CONFIRMED)).toBe(true));
    it('allows DRAFT -> CANCELLED', () => expect(canTransition(OrderStatus.DRAFT, OrderStatus.CANCELLED)).toBe(true));
    it('allows CONFIRMED -> PROCESSING', () => expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true));
    it('allows PROCESSING -> SHIPPED', () => expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true));
    it('allows SHIPPED -> DELIVERED', () => expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true));
    it('allows SHIPPED -> REFUNDED', () => expect(canTransition(OrderStatus.SHIPPED, OrderStatus.REFUNDED)).toBe(true));
    it('disallows DRAFT -> FULFILLED', () => expect(canTransition(OrderStatus.DRAFT, OrderStatus.FULFILLED)).toBe(false));
    it('disallows DELIVERED -> CONFIRMED', () => expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CONFIRMED)).toBe(false));
    it('disallows CANCELLED -> anything', () => {
      for (const s of Object.values(OrderStatus)) {
        expect(canTransition(OrderStatus.CANCELLED, s as OrderStatus)).toBe(false);
      }
    });
  });

  describe('isTerminalStatus', () => {
    it('marks CANCELLED as terminal', () => expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true));
    it('marks REFUNDED as terminal', () => expect(isTerminalStatus(OrderStatus.REFUNDED)).toBe(true));
    it('marks DELIVERED as terminal', () => expect(isTerminalStatus(OrderStatus.DELIVERED)).toBe(true));
    it('does not mark FULFILLED as terminal', () => expect(isTerminalStatus(OrderStatus.FULFILLED)).toBe(false));
    it('does not mark DRAFT as terminal', () => expect(isTerminalStatus(OrderStatus.DRAFT)).toBe(false));
  });

  describe('getAllowedTransitions', () => {
    it('returns [QUOTED, CONFIRMED, CANCELLED] for DRAFT', () => {
      expect(getAllowedTransitions(OrderStatus.DRAFT)).toEqual([OrderStatus.QUOTED, OrderStatus.CONFIRMED, OrderStatus.CANCELLED]);
    });
    it('returns [] for CANCELLED', () => expect(getAllowedTransitions(OrderStatus.CANCELLED)).toEqual([]));
  });
});
