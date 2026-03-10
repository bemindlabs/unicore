// Tests: PlaidAdapter

import { PlaidAdapter } from '../src/adapters/plaid/PlaidAdapter.js';
import type { IPlaidClient } from '../src/adapters/plaid/PlaidAdapter.js';
import type { PlaidConfig } from '../src/types/plaid.js';

// ─── Mock client ──────────────────────────────────────────────────────────────

const mockAccounts = [
  {
    account_id: 'acc_001',
    name: 'Checking',
    official_name: 'Premium Checking',
    type: 'depository',
    subtype: 'checking',
    balances: { current: 1234.56, available: 1000, iso_currency_code: 'USD' },
    mask: '0001',
  },
];

const mockTransactions = [
  {
    transaction_id: 'txn_001',
    account_id: 'acc_001',
    amount: 42.0,
    iso_currency_code: 'USD',
    date: '2024-03-01',
    name: 'Coffee Shop',
    merchant_name: 'Blue Bottle Coffee',
    payment_channel: 'in store',
    pending: false,
    category: ['Food and Drink', 'Restaurants', 'Coffee Shop'],
    category_id: '13005043',
    transaction_type: 'place',
    transaction_code: undefined,
  },
];

function buildMockClient(): IPlaidClient {
  return {
    institutionsGet: jest.fn().mockResolvedValue({ institutions: [{ institution_id: 'ins_1', name: 'Test Bank' }] }),
    linkTokenCreate: jest.fn().mockResolvedValue({
      link_token: 'link-sandbox-xxx',
      expiration: '2024-12-31T00:00:00Z',
      request_id: 'req_001',
    }),
    itemPublicTokenExchange: jest.fn().mockResolvedValue({
      access_token: 'access-sandbox-xxx',
      item_id: 'item_001',
    }),
    accountsGet: jest.fn().mockResolvedValue({ accounts: mockAccounts }),
    transactionsGet: jest.fn().mockResolvedValue({
      transactions: mockTransactions,
      total_transactions: 1,
    }),
  };
}

const validConfig: PlaidConfig = {
  clientId: 'client_xxx',
  secret: 'secret_xxx',
  environment: 'sandbox',
  accessToken: 'access-sandbox-xxx',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlaidAdapter', () => {
  describe('meta', () => {
    it('has the correct metadata', () => {
      const adapter = new PlaidAdapter();
      expect(adapter.meta.id).toBe('plaid');
      expect(adapter.meta.category).toBe('banking');
    });
  });

  describe('connect()', () => {
    it('returns connected health on success', async () => {
      const adapter = new PlaidAdapter(() => buildMockClient());
      const result = await adapter.connect(validConfig);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('connected');
    });

    it('returns error when required fields are missing', async () => {
      const adapter = new PlaidAdapter();
      const result = await adapter.connect({ clientId: '', secret: '', environment: 'sandbox' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CONFIG');
    });

    it('returns error when API throws', async () => {
      const mockClient = buildMockClient();
      (mockClient.institutionsGet as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
      const adapter = new PlaidAdapter(() => mockClient);
      const result = await adapter.connect(validConfig);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLAID_CONNECT_FAILED');
    });
  });

  describe('disconnect()', () => {
    it('disconnects and reports disconnected status', async () => {
      const adapter = new PlaidAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      const result = await adapter.disconnect();
      expect(result.success).toBe(true);

      const health = await adapter.getStatus();
      expect(health.status).toBe('disconnected');
    });
  });

  describe('sync()', () => {
    it('syncs accounts and transactions', async () => {
      const adapter = new PlaidAdapter(() => buildMockClient());
      await adapter.connect(validConfig);
      const result = await adapter.sync();

      expect(result.success).toBe(true);
      expect(result.data?.direction).toBe('inbound');
      // 1 account + 1 transaction
      expect(result.data?.recordsFetched).toBe(2);
    });

    it('returns MISSING_ACCESS_TOKEN when accessToken is absent', async () => {
      const configWithoutToken: PlaidConfig = {
        clientId: 'client_xxx',
        secret: 'secret_xxx',
        environment: 'sandbox',
      };
      const adapter = new PlaidAdapter(() => buildMockClient());
      await adapter.connect(configWithoutToken);
      const result = await adapter.sync();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_ACCESS_TOKEN');
    });

    it('returns NOT_CONNECTED when not connected', async () => {
      const adapter = new PlaidAdapter();
      const result = await adapter.sync();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_CONNECTED');
    });
  });

  describe('createLinkToken()', () => {
    it('creates a link token', async () => {
      const adapter = new PlaidAdapter(() => buildMockClient());
      await adapter.connect(validConfig);

      const result = await adapter.createLinkToken({
        userId: 'user_001',
        clientName: 'UniCore',
        products: ['transactions'],
        countryCodes: ['US'],
        language: 'en',
      });

      expect(result.success).toBe(true);
      expect(result.data?.linkToken).toBe('link-sandbox-xxx');
    });
  });

  describe('exchangePublicToken()', () => {
    it('exchanges a public token and stores the access token', async () => {
      const configNoToken: PlaidConfig = {
        clientId: 'client_xxx',
        secret: 'secret_xxx',
        environment: 'sandbox',
      };
      const adapter = new PlaidAdapter(() => buildMockClient());
      await adapter.connect(configNoToken);

      const result = await adapter.exchangePublicToken('public-sandbox-xxx');

      expect(result.success).toBe(true);
      expect(result.data?.accessToken).toBe('access-sandbox-xxx');
    });
  });
});
