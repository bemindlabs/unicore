import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RedisCounterService } from '../common/redis/redis-counter.service';

jest.mock('bcryptjs');

/**
 * Debt #6 — brute-force login lockout + forgot-password rate limit are now
 * Redis-backed (per-email keys with TTL) so they hold across replicas and
 * survive a deploy. These tests assert:
 *   - lockout is enforced via the Redis-backed counter (mock Redis), and
 *   - the same behavior holds on the in-memory fallback path (Redis down).
 */
describe('AuthService brute-force lockout + forgot rate-limit (debt #6)', () => {
  const PASSWORD_USER = {
    id: 'u1',
    email: 'a@b.com',
    name: 'A',
    role: 'OWNER',
    password: 'hashed',
    tenantId: null,
    activeTenantId: null,
  };

  function buildPrisma() {
    return {
      user: { findUnique: jest.fn(async () => PASSWORD_USER) },
      verificationToken: { create: jest.fn(async () => ({ id: 't1' })) },
    } as any;
  }

  /** A connected counter backed by a mock Redis store. */
  function mockRedisCounter(): { counter: RedisCounterService; store: Map<string, string> } {
    const store = new Map<string, string>();
    const client = {
      incr: jest.fn(async (key: string) => {
        const n = parseInt(store.get(key) ?? '0', 10) + 1;
        store.set(key, String(n));
        return n;
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
    const counter = new RedisCounterService();
    (counter as unknown as { client: unknown }).client = client;
    (counter as unknown as { connected: boolean }).connected = true;
    return { counter, store };
  }

  function build(counter?: RedisCounterService) {
    const prisma = buildPrisma();
    const email = { send: jest.fn(async () => true) };
    const service = new AuthService(
      prisma,
      { sign: jest.fn() } as any,
      {} as any,
      email as any,
      counter,
    );
    return { service, prisma, email };
  }

  beforeEach(() => {
    (bcrypt.compare as jest.Mock).mockReset();
  });

  describe('Redis-backed path', () => {
    it('locks the account after 5 failed attempts and rejects further logins', async () => {
      const { counter, store } = mockRedisCounter();
      const { service } = build(counter);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // 5 bad-password attempts trip the lockout (MAX_LOGIN_ATTEMPTS = 5).
      for (let i = 0; i < 5; i++) {
        expect(await service.validateUser('a@b.com', 'wrong')).toBeNull();
      }
      expect(store.has('login-lock:a@b.com')).toBe(true);

      // Even with the CORRECT password, a locked account is rejected.
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      expect(await service.validateUser('a@b.com', 'correct')).toBeNull();
    });

    it('clears the lockout counters on a successful login', async () => {
      const { counter, store } = mockRedisCounter();
      const { service } = build(counter);

      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await service.validateUser('a@b.com', 'wrong');
      await service.validateUser('a@b.com', 'wrong');
      expect(store.get('login-fail:a@b.com')).toBe('2');

      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      expect(await service.validateUser('a@b.com', 'correct')).not.toBeNull();
      expect(store.has('login-fail:a@b.com')).toBe(false);
      expect(store.has('login-lock:a@b.com')).toBe(false);
    });

    it('rate-limits forgot-password per email (no email after the cap)', async () => {
      const { counter } = mockRedisCounter();
      const { service, email } = build(counter);
      for (let i = 0; i < 5; i++) await service.forgotPassword('a@b.com');
      // FORGOT_MAX_PER_WINDOW = 3 → at most 3 emails sent in the window.
      expect(email.send.mock.calls.length).toBe(3);
    });
  });

  describe('in-memory fallback path (Redis down)', () => {
    it('still enforces lockout after 5 failed attempts', async () => {
      // No counter injected → AuthService owns an in-memory-fallback counter.
      const { service } = build();
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      for (let i = 0; i < 5; i++) {
        expect(await service.validateUser('a@b.com', 'wrong')).toBeNull();
      }
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      expect(await service.validateUser('a@b.com', 'correct')).toBeNull();

      await service.onModuleDestroy();
    });

    it('still rate-limits forgot-password after the cap', async () => {
      const { service, email } = build();
      for (let i = 0; i < 5; i++) await service.forgotPassword('a@b.com');
      expect(email.send.mock.calls.length).toBe(3);
      await service.onModuleDestroy();
    });
  });
});
