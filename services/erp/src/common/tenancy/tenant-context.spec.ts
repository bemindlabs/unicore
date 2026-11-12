import {
  DEFAULT_TENANT_ID,
  getTenantId,
  isValidTenantId,
  runWithTenant,
} from './tenant-context';
import { TenantContextMiddleware } from './tenant-context.middleware';
import type { NextFunction, Request, Response } from 'express';

describe('ERP tenant context', () => {
  describe('getTenantId / runWithTenant', () => {
    it('defaults to the default tenant outside any request scope', () => {
      expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
    });

    it('returns the scoped tenant inside runWithTenant', () => {
      const t = '11111111-1111-1111-1111-111111111111';
      runWithTenant(t, () => {
        expect(getTenantId()).toBe(t);
      });
      // …and resets afterwards.
      expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
    });
  });

  describe('isValidTenantId', () => {
    it('accepts a UUID and rejects junk', () => {
      expect(isValidTenantId('11111111-1111-1111-1111-111111111111')).toBe(true);
      expect(isValidTenantId('not-a-uuid')).toBe(false);
      expect(isValidTenantId(undefined)).toBe(false);
      expect(isValidTenantId("1'; DROP TABLE Contact;--")).toBe(false);
    });
  });

  describe('TenantContextMiddleware', () => {
    const mw = new TenantContextMiddleware();
    const res = {} as Response;

    it('captures a valid x-tenant-id into the context (saas path)', () => {
      const t = '22222222-2222-2222-2222-222222222222';
      const req = { headers: { 'x-tenant-id': t } } as unknown as Request;
      const next: NextFunction = () => {
        expect(getTenantId()).toBe(t);
      };
      mw.use(req, res, next);
    });

    it('falls back to the default tenant when the header is absent (self-host no-op)', () => {
      const req = { headers: {} } as unknown as Request;
      const next: NextFunction = () => {
        expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
      };
      mw.use(req, res, next);
    });

    it('fails closed to the default tenant on a malformed header', () => {
      const req = { headers: { 'x-tenant-id': 'spoofed' } } as unknown as Request;
      const next: NextFunction = () => {
        expect(getTenantId()).toBe(DEFAULT_TENANT_ID);
      };
      mw.use(req, res, next);
    });
  });
});
