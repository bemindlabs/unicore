// Tests: AdapterRegistry

import { AdapterRegistry } from '../src/registry.js';
import { StripeAdapter } from '../src/adapters/stripe/StripeAdapter.js';
import { PlaidAdapter } from '../src/adapters/plaid/PlaidAdapter.js';
import { EmailAdapter } from '../src/adapters/email/EmailAdapter.js';

describe('AdapterRegistry', () => {
  describe('list()', () => {
    it('returns metadata for all built-in adapters', () => {
      const metas = AdapterRegistry.list();
      const ids = metas.map((m) => m.id);

      expect(ids).toContain('stripe');
      expect(ids).toContain('plaid');
      expect(ids).toContain('email');
    });
  });

  describe('has()', () => {
    it('returns true for registered adapters', () => {
      expect(AdapterRegistry.has('stripe')).toBe(true);
      expect(AdapterRegistry.has('plaid')).toBe(true);
      expect(AdapterRegistry.has('email')).toBe(true);
    });

    it('returns false for unknown adapters', () => {
      expect(AdapterRegistry.has('unknown-xyz')).toBe(false);
    });
  });

  describe('create()', () => {
    it('creates a StripeAdapter instance', () => {
      const adapter = AdapterRegistry.create('stripe');
      expect(adapter).toBeInstanceOf(StripeAdapter);
    });

    it('creates a PlaidAdapter instance', () => {
      const adapter = AdapterRegistry.create('plaid');
      expect(adapter).toBeInstanceOf(PlaidAdapter);
    });

    it('creates an EmailAdapter instance', () => {
      const adapter = AdapterRegistry.create('email');
      expect(adapter).toBeInstanceOf(EmailAdapter);
    });

    it('throws for unknown adapter ids', () => {
      expect(() => AdapterRegistry.create('nonexistent')).toThrow('No adapter registered');
    });
  });

  describe('register()', () => {
    it('registers a custom adapter factory', () => {
      const customMeta = {
        id: 'custom-test',
        name: 'Custom Test',
        description: 'A test adapter.',
        version: '0.0.1',
        category: 'custom' as const,
      };
      AdapterRegistry.register('custom-test', () => ({
        meta: customMeta,
        connect: async () => ({ success: true }),
        disconnect: async () => ({ success: true }),
        getStatus: async () => ({ status: 'connected' as const, lastCheckedAt: new Date().toISOString() }),
        sync: async () => ({ success: true, data: { direction: 'inbound' as const, recordsFetched: 0, recordsCreated: 0, recordsUpdated: 0, recordsFailed: 0, errors: [], syncedAt: new Date().toISOString() } }),
      }));

      expect(AdapterRegistry.has('custom-test')).toBe(true);
      const adapter = AdapterRegistry.create('custom-test');
      expect(adapter.meta.id).toBe('custom-test');
    });
  });
});
