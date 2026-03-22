import { RateLimiterService } from './rate-limiter.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    process.env['AGENT_RATE_LIMIT_PER_MINUTE'] = '100';
    service = new RateLimiterService();
  });

  // ---------------------------------------------------------------------------
  // Agent rate limiting
  // ---------------------------------------------------------------------------

  describe('checkAgentLimit', () => {
    it('allows messages within burst capacity', () => {
      for (let i = 0; i < 20; i++) {
        expect(service.checkAgentLimit('agent-1').allowed).toBe(true);
      }
    });

    it('blocks the 21st message when burst is exhausted', () => {
      for (let i = 0; i < 20; i++) {
        service.checkAgentLimit('agent-1');
      }
      const result = service.checkAgentLimit('agent-1');
      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('increments throttledCount on each blocked message', () => {
      for (let i = 0; i < 20; i++) service.checkAgentLimit('agent-2');
      service.checkAgentLimit('agent-2');
      const result = service.checkAgentLimit('agent-2');
      expect(result.throttledCount).toBe(2);
    });

    it('isolates buckets per agentId', () => {
      for (let i = 0; i < 20; i++) service.checkAgentLimit('agent-a');
      expect(service.checkAgentLimit('agent-a').allowed).toBe(false);
      expect(service.checkAgentLimit('agent-b').allowed).toBe(true);
    });

    it('reads AGENT_RATE_LIMIT_PER_MINUTE from env', () => {
      process.env['AGENT_RATE_LIMIT_PER_MINUTE'] = '60';
      const svc = new RateLimiterService();
      // Burst of 20 should still be allowed
      for (let i = 0; i < 20; i++) {
        expect(svc.checkAgentLimit('agent-x').allowed).toBe(true);
      }
      expect(svc.checkAgentLimit('agent-x').allowed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Channel rate limiting
  // ---------------------------------------------------------------------------

  describe('checkChannelLimit', () => {
    it('allows messages within channel burst capacity', () => {
      for (let i = 0; i < 20; i++) {
        expect(service.checkChannelLimit('chan-1').allowed).toBe(true);
      }
    });

    it('blocks messages exceeding channel burst', () => {
      for (let i = 0; i < 20; i++) service.checkChannelLimit('chan-1');
      expect(service.checkChannelLimit('chan-1').allowed).toBe(false);
    });

    it('isolates buckets per channel', () => {
      for (let i = 0; i < 20; i++) service.checkChannelLimit('chan-a');
      expect(service.checkChannelLimit('chan-a').allowed).toBe(false);
      expect(service.checkChannelLimit('chan-b').allowed).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  describe('getAgentMetrics', () => {
    it('returns empty array when no agents have messaged', () => {
      expect(service.getAgentMetrics()).toEqual([]);
    });

    it('tracks messagesInWindow and throttledCount', () => {
      for (let i = 0; i < 20; i++) service.checkAgentLimit('agent-m');
      service.checkAgentLimit('agent-m'); // throttled
      const [m] = service.getAgentMetrics();
      expect(m.agentId).toBe('agent-m');
      expect(m.messagesInWindow).toBe(20);
      expect(m.throttledCount).toBe(1);
      expect(m.windowResetAt).toBeDefined();
    });
  });

  describe('getChannelMetrics', () => {
    it('returns empty array when no channels have been used', () => {
      expect(service.getChannelMetrics()).toEqual([]);
    });

    it('tracks channel messagesInWindow', () => {
      service.checkChannelLimit('my-channel');
      service.checkChannelLimit('my-channel');
      const [m] = service.getChannelMetrics();
      expect(m.channel).toBe('my-channel');
      expect(m.messagesInWindow).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Token refill
  // ---------------------------------------------------------------------------

  describe('token refill', () => {
    it('allows messages again after tokens refill', () => {
      jest.useFakeTimers();
      const svc = new RateLimiterService();

      // Drain the burst bucket
      for (let i = 0; i < 20; i++) svc.checkAgentLimit('agent-r');
      expect(svc.checkAgentLimit('agent-r').allowed).toBe(false);

      // Advance time by 1 second — should refill ~1.67 tokens at 100/min
      jest.advanceTimersByTime(1200);
      expect(svc.checkAgentLimit('agent-r').allowed).toBe(true);

      jest.useRealTimers();
    });
  });
});
