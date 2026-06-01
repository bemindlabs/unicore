import { RedisCounterService } from './redis-counter.service';

/**
 * Debt #6 — the shared Redis-backed counter primitive. Verifies the Redis path
 * (atomic INCR + first-hit EXPIRE, flag set/has/del) and the in-memory fallback
 * path (used when Redis is down) including window/TTL expiry.
 */
describe('RedisCounterService', () => {
  describe('in-memory fallback (Redis not connected)', () => {
    let svc: RedisCounterService;

    beforeEach(() => {
      svc = new RedisCounterService(); // onModuleInit never called → fallback
    });

    it('reports it is NOT using Redis', () => {
      expect(svc.usingRedis).toBe(false);
    });

    it('increments within a window and resets after it expires', async () => {
      const t0 = 1_000_000;
      expect(await svc.increment('k', 60_000, t0)).toBe(1);
      expect(await svc.increment('k', 60_000, t0 + 1)).toBe(2);
      expect(await svc.increment('k', 60_000, t0 + 2)).toBe(3);
      // Past the window → fresh count.
      expect(await svc.increment('k', 60_000, t0 + 60_001)).toBe(1);
    });

    it('tracks distinct keys independently', async () => {
      const t0 = 2_000_000;
      await svc.increment('a', 60_000, t0);
      await svc.increment('a', 60_000, t0);
      await svc.increment('b', 60_000, t0);
      expect(await svc.get('a', t0)).toBe(2);
      expect(await svc.get('b', t0)).toBe(1);
    });

    it('sets, reads, and deletes a flag with TTL expiry', async () => {
      const t0 = 3_000_000;
      await svc.setFlag('lock', 15_000, t0);
      expect(await svc.hasFlag('lock', t0)).toBe(true);
      // After TTL the flag is gone.
      expect(await svc.hasFlag('lock', t0 + 15_001)).toBe(false);

      await svc.setFlag('lock2', 15_000, t0);
      await svc.del('lock2');
      expect(await svc.hasFlag('lock2', t0)).toBe(false);
    });
  });

  describe('Redis-backed (mock Redis client)', () => {
    let svc: RedisCounterService;
    let store: Map<string, string>;
    let mock: {
      incr: jest.Mock;
      expire: jest.Mock;
      get: jest.Mock;
      set: jest.Mock;
      exists: jest.Mock;
      del: jest.Mock;
      quit: jest.Mock;
    };

    beforeEach(() => {
      store = new Map();
      mock = {
        incr: jest.fn(async (key: string) => {
          const next = parseInt(store.get(key) ?? '0', 10) + 1;
          store.set(key, String(next));
          return next;
        }),
        expire: jest.fn(async () => 1),
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, val: string) => {
          store.set(key, val);
          return 'OK';
        }),
        exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
        del: jest.fn(async (key: string) => (store.delete(key) ? 1 : 0)),
        quit: jest.fn(async () => undefined),
      };
      svc = new RedisCounterService();
      // Inject the mock as the live, connected client.
      (svc as unknown as { client: unknown }).client = mock;
      (svc as unknown as { connected: boolean }).connected = true;
    });

    it('reports it IS using Redis', () => {
      expect(svc.usingRedis).toBe(true);
    });

    it('uses atomic INCR and sets TTL on the first hit only', async () => {
      expect(await svc.increment('login-fail:a@b.com', 900_000)).toBe(1);
      expect(await svc.increment('login-fail:a@b.com', 900_000)).toBe(2);
      expect(mock.incr).toHaveBeenCalledTimes(2);
      // EXPIRE only on the first increment (count === 1).
      expect(mock.expire).toHaveBeenCalledTimes(1);
      expect(mock.expire).toHaveBeenCalledWith('login-fail:a@b.com', 900);
    });

    it('reads a counter via GET', async () => {
      await svc.increment('forgot:a@b.com', 900_000);
      expect(await svc.get('forgot:a@b.com')).toBe(1);
    });

    it('sets / checks / deletes a flag via SET EX, EXISTS, DEL', async () => {
      await svc.setFlag('login-lock:a@b.com', 900_000);
      expect(mock.set).toHaveBeenCalledWith('login-lock:a@b.com', '1', { EX: 900 });
      expect(await svc.hasFlag('login-lock:a@b.com')).toBe(true);
      await svc.del('login-lock:a@b.com');
      expect(await svc.hasFlag('login-lock:a@b.com')).toBe(false);
    });

    it('falls back to in-memory when a Redis op throws (degrade, do not crash)', async () => {
      mock.incr.mockRejectedValueOnce(new Error('connection reset'));
      // First call fails over to memory and flips connected=false.
      expect(await svc.increment('k', 60_000)).toBe(1);
      expect(svc.usingRedis).toBe(false);
      // Subsequent calls stay on the in-memory path.
      expect(await svc.increment('k', 60_000)).toBe(2);
    });
  });
});
