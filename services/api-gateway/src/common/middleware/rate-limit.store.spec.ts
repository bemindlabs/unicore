import { RateLimitStore } from './rate-limit.store';

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
});
