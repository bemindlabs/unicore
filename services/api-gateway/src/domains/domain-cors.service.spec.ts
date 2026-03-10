import { Test, TestingModule } from '@nestjs/testing';
import { DomainCorsService } from './domain-cors.service';
import type { DomainResolution } from './types/domain.types';

const makeResolution = (overrides: Partial<DomainResolution> = {}): DomainResolution => ({
  hostname: 'app.acme.com',
  tenantId: 'tenant-123',
  allowedOrigins: ['https://app.acme.com'],
  isVerified: true,
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('DomainCorsService', () => {
  let service: DomainCorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DomainCorsService],
    }).compile();

    service = module.get<DomainCorsService>(DomainCorsService);
  });

  describe('isOriginAllowed', () => {
    it('allows exact match', () => {
      expect(service.isOriginAllowed('https://app.acme.com', ['https://app.acme.com'])).toBe(true);
    });

    it('allows wildcard "*"', () => {
      expect(service.isOriginAllowed('https://anything.com', ['*'])).toBe(true);
    });

    it('allows wildcard subdomain pattern "*.acme.com"', () => {
      expect(service.isOriginAllowed('https://sub.acme.com', ['*.acme.com'])).toBe(true);
    });

    it('allows the base domain itself when wildcard subdomain pattern provided', () => {
      expect(service.isOriginAllowed('https://acme.com', ['*.acme.com'])).toBe(true);
    });

    it('rejects origin not in list', () => {
      expect(service.isOriginAllowed('https://evil.com', ['https://app.acme.com'])).toBe(false);
    });

    it('rejects wildcard subdomain mismatch', () => {
      expect(service.isOriginAllowed('https://sub.other.com', ['*.acme.com'])).toBe(false);
    });
  });

  describe('buildCorsOptions', () => {
    it('returns permissive defaults when resolution is null', () => {
      const opts = service.buildCorsOptions('https://anything.com', null);
      expect(opts.credentials).toBe(true);
      expect(opts.methods).toContain('GET');
    });

    it('returns same-origin CORS when domain has no allowedOrigins', () => {
      const resolution = makeResolution({ allowedOrigins: [] });
      const opts = service.buildCorsOptions('https://app.acme.com', resolution);
      expect(opts.credentials).toBe(true);
    });

    it('allows matching origin when origin is in allowedOrigins', () => {
      const resolution = makeResolution({
        allowedOrigins: ['https://app.acme.com'],
      });
      const opts = service.buildCorsOptions('https://app.acme.com', resolution);
      expect(opts.origin).toBe('https://app.acme.com');
    });

    it('rejects non-matching origin', () => {
      const resolution = makeResolution({
        allowedOrigins: ['https://app.acme.com'],
      });
      const opts = service.buildCorsOptions('https://evil.com', resolution);
      expect(opts.origin).toBe(false);
    });

    it('includes CORS headers (methods, allowedHeaders, exposedHeaders)', () => {
      const opts = service.buildCorsOptions(undefined, null);
      expect(opts.methods.length).toBeGreaterThan(0);
      expect(opts.allowedHeaders.length).toBeGreaterThan(0);
      expect(opts.exposedHeaders.length).toBeGreaterThan(0);
      expect(opts.maxAge).toBeGreaterThan(0);
    });
  });
});
