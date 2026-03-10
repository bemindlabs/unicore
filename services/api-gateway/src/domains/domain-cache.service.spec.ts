import { Test, TestingModule } from '@nestjs/testing';
import { DomainCacheService } from './domain-cache.service';
import type { DomainCacheEntry } from './types/domain.types';

/**
 * These tests mock the redis client to avoid requiring a real Redis instance.
 */

const makeEntry = (tenantId = 'tenant-abc'): DomainCacheEntry => ({
  tenantId,
  allowedOrigins: ['https://example.com'],
  isVerified: true,
  updatedAt: new Date().toISOString(),
  cachedAt: Date.now(),
});

describe('DomainCacheService', () => {
  let service: DomainCacheService;

  // In-memory mock store
  const mockStore = new Map<string, string>();

  const mockRedisClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    set: jest.fn((key: string, value: string) => {
      mockStore.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve(1);
    }),
    scanIterator: jest.fn(function* () {
      yield* mockStore.keys();
    }),
  };

  beforeEach(async () => {
    mockStore.clear();
    jest.clearAllMocks();

    // Simulate connect event triggering 'connect' callback
    mockRedisClient.on.mockImplementation((event: string, cb: () => void) => {
      if (event === 'connect') cb();
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainCacheService],
    }).compile();

    service = module.get<DomainCacheService>(DomainCacheService);

    // Inject the mock client and set connected=true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).client = mockRedisClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).connected = true;
  });

  describe('get', () => {
    it('returns null on cache miss', async () => {
      const result = await service.get('unknown.example.com');
      expect(result).toBeNull();
    });

    it('returns parsed entry on cache hit', async () => {
      const entry = makeEntry('tenant-hit');
      mockStore.set('domain:app.acme.com', JSON.stringify(entry));

      const result = await service.get('app.acme.com');

      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe('tenant-hit');
    });

    it('returns null when not connected', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).connected = false;
      const result = await service.get('app.acme.com');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores entry in Redis with EX option', async () => {
      const entry = makeEntry('tenant-set');
      await service.set('app.acme.com', entry);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'domain:app.acme.com',
        JSON.stringify(entry),
        expect.objectContaining({ EX: expect.any(Number) }),
      );
    });

    it('does nothing when not connected', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).connected = false;
      await service.set('app.acme.com', makeEntry());
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('deletes the key from Redis', async () => {
      const entry = makeEntry();
      mockStore.set('domain:app.acme.com', JSON.stringify(entry));

      await service.invalidate('app.acme.com');

      expect(mockRedisClient.del).toHaveBeenCalledWith('domain:app.acme.com');
    });

    it('does nothing when not connected', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).connected = false;
      await service.invalidate('app.acme.com');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateByTenant', () => {
    it('removes all entries for a given tenantId', async () => {
      mockStore.set('domain:a.acme.com', JSON.stringify(makeEntry('tenant-A')));
      mockStore.set('domain:b.acme.com', JSON.stringify(makeEntry('tenant-A')));
      mockStore.set('domain:c.other.com', JSON.stringify(makeEntry('tenant-B')));

      const removed = await service.invalidateByTenant('tenant-A');

      expect(removed).toBe(2);
      expect(mockStore.has('domain:c.other.com')).toBe(true);
    });

    it('returns 0 when not connected', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).connected = false;
      const removed = await service.invalidateByTenant('tenant-A');
      expect(removed).toBe(0);
    });
  });

  describe('ttlSeconds', () => {
    it('exposes the configured TTL', () => {
      expect(service.ttlSeconds).toBeGreaterThan(0);
    });
  });
});
