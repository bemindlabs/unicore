import { RateLimitStore } from './rate-limit.store';
import { RedisCounterService } from '../redis/redis-counter.service';

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  beforeEach(() => {
    store = new RateLimitStore();
  });

  afterEach(() => {
    store.onModuleDestroy();
  });

  describe('increment', () => {
    it('returns count=1 on first call for a key', () => {
      const result = store.increment('user:abc', 60_000);
      expect(result.count).toBe(1);
    });

    it('increments the count for the same key within the window', () => {
      store.increment('user:abc', 60_000);
      store.increment('user:abc', 60_000);
      const result = store.increment('user:abc', 60_000);
      expect(result.count).toBe(3);
    });

    it('resets the counter after the window expires', () => {
      store.increment('user:abc', 1);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const result = store.increment('user:abc', 1);
          expect(result.count).toBe(1);
          resolve();
        }, 10);
      });
    });

    it('tracks different keys independently', () => {
      store.increment('user:a', 60_000);
      store.increment('user:a', 60_000);
      store.increment('user:b', 60_000);
      const resultA = store.increment('user:a', 60_000);
      const resultB = store.increment('user:b', 60_000);
      expect(resultA.count).toBe(3);
      expect(resultB.count).toBe(2);
    });

    it('returns a resetAt timestamp in the future', () => {
      const before = Date.now();
      const result = store.increment('ip:127.0.0.1', 60_000);
      expect(result.resetAt).toBeGreaterThan(before);
    });

    it('returns resetInMs > 0 within an active window', () => {
      store.increment('ip:127.0.0.1', 60_000);
      const result = store.increment('ip:127.0.0.1', 60_000);
      expect(result.resetInMs).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('removes entries older than maxAgeMs', () => {
      store.increment('old-key', 60_000);
      const removed = store.cleanup(-1);
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(store.size).toBe(0);
    });

    it('preserves recent entries', () => {
      store.increment('fresh-key', 60_000);
      const removed = store.cleanup(60_000);
      expect(removed).toBe(0);
      expect(store.size).toBe(1);
    });
  });

  describe('size', () => {
    it('reflects the number of tracked keys', () => {
      expect(store.size).toBe(0);
      store.increment('k1', 60_000);
      store.increment('k2', 60_000);
      expect(store.size).toBe(2);
    });
  });

  // Debt #6 — Redis-backed counters so limits hold across replicas. The public
  // increment() API stays synchronous; the store reconciles its local window
  // up to the shared Redis total in the background.
  describe('Redis-backed reconciliation', () => {
    function connectedCounter(sharedStart: number) {
      const shared = { n: sharedStart };
      const counter = {
        get usingRedis() {
          return true;
        },
        increment: jest.fn(async () => {
          shared.n += 1;
          return shared.n;
        }),
      } as unknown as RedisCounterService;
      return { counter, shared };
    }

    it('keeps a synchronous increment() contract', () => {
      const { counter } = connectedCounter(0);
      const s = new RateLimitStore(counter);
      const result = s.increment('ip:1.2.3.4', 60_000);
      expect(result.count).toBe(1); // returns immediately, no await
    });

    it('reconciles the local count UP to the shared Redis total', async () => {
      // Another replica has already counted 9 hits for this key.
      const { counter } = connectedCounter(9);
      const s = new RateLimitStore(counter);

      const first = s.increment('tenant-rl:t1', 60_000);
      expect(first.count).toBe(1); // local view before reconciliation

      // Let the fire-and-forget Redis mirror resolve.
      await new Promise((r) => setImmediate(r));

      // Next call sees the reconciled cross-replica total (10 + this hit).
      const second = s.increment('tenant-rl:t1', 60_000);
      expect(second.count).toBeGreaterThanOrEqual(10);
      expect(counter.increment).toHaveBeenCalled();
    });

    it('does not call Redis when the counter is in fallback mode', () => {
      const counter = {
        get usingRedis() {
          return false;
        },
        increment: jest.fn(),
      } as unknown as RedisCounterService;
      const s = new RateLimitStore(counter);
      s.increment('ip:9.9.9.9', 60_000);
      expect(counter.increment).not.toHaveBeenCalled();
    });
  });
});
