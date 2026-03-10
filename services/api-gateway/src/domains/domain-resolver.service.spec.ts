import { Test, TestingModule } from '@nestjs/testing';
import { DomainResolverService } from './domain-resolver.service';
import { DomainCacheService } from './domain-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import type { DomainCacheEntry } from './types/domain.types';

const makeCacheEntry = (tenantId: string): DomainCacheEntry => ({
  tenantId,
  allowedOrigins: ['https://acme.com'],
  isVerified: true,
  updatedAt: new Date().toISOString(),
  cachedAt: Date.now(),
});

describe('DomainResolverService', () => {
  let service: DomainResolverService;
  let cache: jest.Mocked<DomainCacheService>;
  let prisma: { customDomain: { findUnique: jest.Mock } };

  beforeEach(async () => {
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      invalidateByTenant: jest.fn().mockResolvedValue(0),
      ttlSeconds: 300,
    } as unknown as jest.Mocked<DomainCacheService>;

    prisma = {
      customDomain: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DomainResolverService,
        { provide: DomainCacheService, useValue: cache },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DomainResolverService>(DomainResolverService);
  });

  describe('normalizeHostname', () => {
    it('strips port from host header', () => {
      expect(service.normalizeHostname('example.com:3000')).toBe('example.com');
    });

    it('lower-cases the hostname', () => {
      expect(service.normalizeHostname('EXAMPLE.COM')).toBe('example.com');
    });

    it('trims whitespace', () => {
      expect(service.normalizeHostname('  example.com  ')).toBe('example.com');
    });
  });

  describe('isPlatformDomain', () => {
    it('identifies platform domains as platform-owned', () => {
      expect(service.isPlatformDomain('localhost')).toBe(true);
    });

    it('identifies subdomains of platform domains', () => {
      expect(service.isPlatformDomain('api.unicore.io')).toBe(true);
    });

    it('does not flag an arbitrary domain as platform', () => {
      expect(service.isPlatformDomain('app.acme.com')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('returns null for platform domains without DB lookup', async () => {
      const result = await service.resolve('localhost');
      expect(result).toBeNull();
      expect(cache.get).not.toHaveBeenCalled();
      expect(prisma.customDomain.findUnique).not.toHaveBeenCalled();
    });

    it('returns resolution from cache on cache hit', async () => {
      cache.get.mockResolvedValue(makeCacheEntry('tenant-abc'));

      const result = await service.resolve('app.acme.com');

      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe('tenant-abc');
      expect(prisma.customDomain.findUnique).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('queries the database on cache miss and populates cache', async () => {
      cache.get.mockResolvedValue(null);
      prisma.customDomain.findUnique.mockResolvedValue({
        tenantId: 'tenant-xyz',
        allowedOrigins: ['https://app.acme.com'],
        isVerified: true,
        updatedAt: new Date(),
      });

      const result = await service.resolve('app.acme.com');

      expect(result).not.toBeNull();
      expect(result!.tenantId).toBe('tenant-xyz');
      expect(cache.set).toHaveBeenCalledWith(
        'app.acme.com',
        expect.objectContaining({ tenantId: 'tenant-xyz' }),
      );
    });

    it('returns null and logs warning for unknown hosts', async () => {
      cache.get.mockResolvedValue(null);
      prisma.customDomain.findUnique.mockResolvedValue(null);

      const result = await service.resolve('unknown.example.com');

      expect(result).toBeNull();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('normalizes host header with port before lookup', async () => {
      cache.get.mockResolvedValue(null);
      prisma.customDomain.findUnique.mockResolvedValue({
        tenantId: 'tenant-port',
        allowedOrigins: [],
        isVerified: false,
        updatedAt: new Date(),
      });

      await service.resolve('app.acme.com:8080');

      expect(cache.get).toHaveBeenCalledWith('app.acme.com');
      expect(prisma.customDomain.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hostname: 'app.acme.com' } }),
      );
    });

    it('returns null and does not throw when DB errors', async () => {
      cache.get.mockResolvedValue(null);
      prisma.customDomain.findUnique.mockRejectedValue(new Error('DB down'));

      await expect(service.resolve('app.acme.com')).resolves.toBeNull();
    });
  });
});
