// Tests: StripeAdapter

import { StripeAdapter } from '../src/adapters/stripe/StripeAdapter.js';
import type { IStripeClient } from '../src/adapters/stripe/StripeAdapter.js';
import type { StripeConfig } from '../src/types/stripe.js';

// ─── Mock client ──────────────────────────────────────────────────────────────

const mockPaymentIntents = [
  {
    id: 'pi_test_001',
    amount: 5000,
    currency: 'usd',
    status: 'succeeded',
    customer: 'cus_001',
    description: 'Test payment',
    metadata: {},
    created: 1700000000,
  },
];

const mockCharges = [
  {
    id: 'ch_test_001',
    payment_intent: 'pi_test_001',
    amount: 5000,
    amount_refunded: 0,
    currency: 'usd',
    status: 'succeeded',
    failure_code: null,
    failure_message: null,
    receipt_url: 'https://pay.stripe.com/receipts/test',
    created: 1700000000,
  },
];

function buildMockClient(): IStripeClient {
  return {
    retrieveAccount: jest.fn().mockResolvedValue({ id: 'acct_test' }),
    listPaymentIntents: jest.fn().mockResolvedValue({ data: mockPaymentIntents, has_more: false }),
    listCharges: jest.fn().mockResolvedValue({ data: mockCharges, has_more: false }),
  };
}

const validConfig: StripeConfig = { secretKey: 'sk_test_xxx' };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StripeAdapter', () => {
  describe('meta', () => {
    it('has the correct metadata', () => {
      const adapter = new StripeAdapter();
      expect(adapter.meta.id).toBe('stripe');
      expect(adapter.meta.category).toBe('payment');
    });
  });

  describe('connect()', () => {
    it('returns connected health on success', async () => {
      const mockClient = buildMockClient();
      const adapter = new StripeAdapter(() => mockClient);

      const result = await adapter.connect(validConfig);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('connected');
      expect(typeof result.data?.latencyMs).toBe('number');
    });

    it('returns error when secretKey is missing', async () => {
      const adapter = new StripeAdapter();
      const result = await adapter.connect({ secretKey: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONFIG');
    });

    it('returns error when API call throws', async () => {
      const mockClient: IStripeClient = {
        retrieveAccount: jest.fn().mockRejectedValue(new Error('Network error')),
        listPaymentIntents: jest.fn(),
        listCharges: jest.fn(),
      };
      const adapter = new StripeAdapter(() => mockClient);
      const result = await adapter.connect(validConfig);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STRIPE_CONNECT_FAILED');
    });
  });

  describe('disconnect()', () => {
    it('disconnects cleanly', async () => {
      const adapter = new StripeAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      const result = await adapter.disconnect();

      expect(result.success).toBe(true);
    });

    it('returns disconnected status after disconnect', async () => {
      const adapter = new StripeAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      await adapter.disconnect();
      const health = await adapter.getStatus();

      expect(health.status).toBe('disconnected');
    });
  });

  describe('getStatus()', () => {
    it('returns connected when client is healthy', async () => {
      const adapter = new StripeAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      const health = await adapter.getStatus();

      expect(health.status).toBe('connected');
    });

    it('returns disconnected when not connected', async () => {
      const adapter = new StripeAdapter();
      const health = await adapter.getStatus();

      expect(health.status).toBe('disconnected');
    });

    it('returns error when API call fails', async () => {
      // Connect successfully first, then fail on getStatus
      const mockClient = buildMockClient();
      const adapter = new StripeAdapter(() => mockClient);
      await adapter.connect(validConfig);

      // Now make subsequent calls to retrieveAccount fail
      (mockClient.retrieveAccount as jest.Mock).mockRejectedValue(new Error('timeout'));
      const health = await adapter.getStatus();

      expect(health.status).toBe('error');
      expect(health.message).toBe('timeout');
    });
  });

  describe('sync()', () => {
    it('returns an inbound sync result with fetched records', async () => {
      const adapter = new StripeAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      const result = await adapter.sync();

      expect(result.success).toBe(true);
      expect(result.data?.direction).toBe('inbound');
      // 1 payment intent + 1 charge
      expect(result.data?.recordsFetched).toBe(2);
      expect(result.data?.recordsFailed).toBe(0);
    });

    it('accepts a since option', async () => {
      const mockClient = buildMockClient();
      const adapter = new StripeAdapter(() => mockClient);
      await adapter.connect(validConfig);

      await adapter.sync({ since: '2024-01-01T00:00:00Z' });

      expect(mockClient.listPaymentIntents).toHaveBeenCalledWith(
        expect.objectContaining({ created: { gte: expect.any(Number) } }),
      );
    });

    it('returns NOT_CONNECTED error when called before connect', async () => {
      const adapter = new StripeAdapter();
      const result = await adapter.sync();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_CONNECTED');
    });
  });
});
