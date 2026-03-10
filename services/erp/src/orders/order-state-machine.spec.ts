import { canTransition, getAllowedTransitions, isTerminalStatus, OrderStatus } from './order-state-machine';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    it('should allow PENDING -> CONFIRMED', () => {
      expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should allow CONFIRMED -> PROCESSING', () => {
      expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
    });

    it('should allow PROCESSING -> SHIPPED', () => {
      expect(canTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
    });

    it('should allow SHIPPED -> FULFILLED', () => {
      expect(canTransition(OrderStatus.SHIPPED, OrderStatus.FULFILLED)).toBe(true);
    });

    it('should NOT allow PENDING -> FULFILLED directly', () => {
      expect(canTransition(OrderStatus.PENDING, OrderStatus.FULFILLED)).toBe(false);
    });

    it('should NOT allow CANCELLED -> CONFIRMED', () => {
      expect(canTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
    });

    it('should NOT allow FULFILLED -> CONFIRMED', () => {
      expect(canTransition(OrderStatus.FULFILLED, OrderStatus.CONFIRMED)).toBe(false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return [CONFIRMED, CANCELLED] for PENDING', () => {
      const allowed = getAllowedTransitions(OrderStatus.PENDING);
      expect(allowed).toContain(OrderStatus.CONFIRMED);
      expect(allowed).toContain(OrderStatus.CANCELLED);
    });

    it('should return empty array for CANCELLED', () => {
      expect(getAllowedTransitions(OrderStatus.CANCELLED)).toHaveLength(0);
    });
  });

  describe('isTerminalStatus', () => {
    it('should identify CANCELLED as terminal', () => {
      expect(isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
    });

    it('should identify REFUNDED as terminal', () => {
      expect(isTerminalStatus(OrderStatus.REFUNDED)).toBe(true);
    });

    it('should NOT identify PENDING as terminal', () => {
      expect(isTerminalStatus(OrderStatus.PENDING)).toBe(false);
    });
  });
});
