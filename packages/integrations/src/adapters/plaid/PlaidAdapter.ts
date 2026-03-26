// Plaid Bank Feed Adapter — @bemindlabs/unicore-integrations
// Syncs accounts and transactions from Plaid.

import type { IAdapter, AdapterMeta, AdapterHealth, AdapterResult, AdapterError, SyncOptions, SyncResult } from '../../types/adapter.js';
import type {
  PlaidConfig,
  PlaidAccount,
  PlaidTransaction,
  PlaidLinkToken,
  PlaidLinkTokenRequest,
  PlaidSyncData,
} from '../../types/plaid.js';
import { ok, okVoid, err, tryCatch, toAdapterError } from '../../utils/result.js';
import { validateRequiredFields } from '../../utils/validation.js';

const META: AdapterMeta = {
  id: 'plaid',
  name: 'Plaid',
  description: 'Sync bank accounts and transactions via the Plaid API.',
  version: '0.1.0',
  category: 'banking',
};

// ─── Plaid client contract (injectable for testing) ──────────────────────────

export interface IPlaidClient {
  /** Validate credentials by calling a lightweight endpoint. */
  institutionsGet(params: { count: number; offset: number; country_codes: string[] }): Promise<{
    institutions: Array<{ institution_id: string; name: string }>;
  }>;

  /** Create a Link token for the front-end Link flow. */
  linkTokenCreate(params: PlaidLinkTokenRequest): Promise<{
    link_token: string;
    expiration: string;
    request_id: string;
  }>;

  /** Exchange a public token for an access token. */
  itemPublicTokenExchange(params: { public_token: string }): Promise<{
    access_token: string;
    item_id: string;
  }>;

  /** List accounts for the current access token. */
  accountsGet(params: { access_token: string }): Promise<{
    accounts: RawPlaidAccount[];
  }>;

  /** Paginated transaction sync. */
  transactionsGet(params: {
    access_token: string;
    start_date: string;
    end_date: string;
    count?: number;
    offset?: number;
  }): Promise<{
    transactions: RawPlaidTransaction[];
    total_transactions: number;
  }>;
}

// ─── Raw Plaid API shapes ─────────────────────────────────────────────────────

interface RawPlaidAccount {
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  balances: {
    current?: number;
    available?: number;
    limit?: number;
    iso_currency_code?: string;
  };
  mask?: string;
}

interface RawPlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code?: string;
  date: string;
  name: string;
  merchant_name?: string;
  payment_channel: string;
  pending: boolean;
  category?: string[];
  category_id?: string;
  transaction_type: string;
  transaction_code?: string;
}

// ─── Plaid Adapter ────────────────────────────────────────────────────────────

export class PlaidAdapter implements IAdapter<PlaidConfig, PlaidSyncData> {
  readonly meta: AdapterMeta = META;

  #config: PlaidConfig | null = null;
  #client: IPlaidClient | null = null;
  #lastCheckedAt = new Date().toISOString();

  constructor(private readonly clientFactory?: (config: PlaidConfig) => IPlaidClient) {}

  // ─── connect ──────────────────────────────────────────────────────────────

  async connect(config: PlaidConfig): Promise<AdapterResult<AdapterHealth>> {
    const validationError = validateRequiredFields(config, ['clientId', 'secret', 'environment']);
    if (validationError) return err<AdapterHealth>(validationError);

    return tryCatch(async () => {
      const client = this.#buildClient(config);
      const start = Date.now();

      await client.institutionsGet({ count: 1, offset: 0, country_codes: ['US'] });

      const latencyMs = Date.now() - start;
      this.#config = config;
      this.#client = client;
      this.#lastCheckedAt = new Date().toISOString();

      const health: AdapterHealth = {
        status: 'connected',
        latencyMs,
        lastCheckedAt: this.#lastCheckedAt,
      };
      return ok<AdapterHealth>(health);
    }, 'PLAID_CONNECT_FAILED');
  }

  // ─── disconnect ───────────────────────────────────────────────────────────

  async disconnect(): Promise<AdapterResult> {
    this.#client = null;
    this.#config = null;
    this.#lastCheckedAt = new Date().toISOString();
    return okVoid();
  }

  // ─── getStatus ────────────────────────────────────────────────────────────

  async getStatus(): Promise<AdapterHealth> {
    if (!this.#client) {
      return { status: 'disconnected', lastCheckedAt: this.#lastCheckedAt };
    }

    try {
      const start = Date.now();
      await this.#client.institutionsGet({ count: 1, offset: 0, country_codes: ['US'] });
      const latencyMs = Date.now() - start;
      this.#lastCheckedAt = new Date().toISOString();
      return { status: 'connected', latencyMs, lastCheckedAt: this.#lastCheckedAt };
    } catch (thrown) {
      this.#lastCheckedAt = new Date().toISOString();
      return {
        status: 'error',
        lastCheckedAt: this.#lastCheckedAt,
        message: toAdapterError(thrown).message,
      };
    }
  }

  // ─── sync ─────────────────────────────────────────────────────────────────

  async sync(options?: SyncOptions): Promise<AdapterResult<SyncResult>> {
    if (!this.#client || !this.#config) {
      return err<SyncResult>({
        code: 'NOT_CONNECTED',
        message: 'Call connect() before sync().',
        retryable: false,
      });
    }

    if (!this.#config.accessToken) {
      return err<SyncResult>({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'An access token is required to sync transactions. Complete the Plaid Link flow first.',
        retryable: false,
      });
    }

    return tryCatch(async () => {
      const endDate = new Date().toISOString().split('T')[0]!;
      const startDate = options?.since
        ? options.since.split('T')[0]!
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      const limit = options?.limit ?? 500;

      const [accountsResult, transactionsResult] = await Promise.all([
        this.#fetchAccounts(),
        this.#fetchTransactions(startDate, endDate, limit),
      ]);

      const allErrors = [...accountsResult.errors, ...transactionsResult.errors];

      const result: SyncResult = {
        direction: 'inbound',
        recordsFetched: accountsResult.fetched + transactionsResult.fetched,
        recordsCreated: accountsResult.fetched + transactionsResult.fetched,
        recordsUpdated: 0,
        recordsFailed: allErrors.length,
        errors: allErrors,
        syncedAt: new Date().toISOString(),
      };

      return ok<SyncResult>(result);
    }, 'PLAID_SYNC_FAILED');
  }

  // ─── Link token helpers ────────────────────────────────────────────────────

  async createLinkToken(request: PlaidLinkTokenRequest): Promise<AdapterResult<PlaidLinkToken>> {
    if (!this.#client) {
      return err<PlaidLinkToken>({
        code: 'NOT_CONNECTED',
        message: 'Call connect() before createLinkToken().',
        retryable: false,
      });
    }

    return tryCatch(async () => {
      const response = await this.#client!.linkTokenCreate(request);
      return ok<PlaidLinkToken>({
        linkToken: response.link_token,
        expiration: response.expiration,
        requestId: response.request_id,
      });
    }, 'PLAID_LINK_TOKEN_FAILED');
  }

  async exchangePublicToken(
    publicToken: string,
  ): Promise<AdapterResult<{ accessToken: string; itemId: string }>> {
    if (!this.#client || !this.#config) {
      return err({ code: 'NOT_CONNECTED', message: 'Call connect() first.', retryable: false });
    }

    return tryCatch(async () => {
      const response = await this.#client!.itemPublicTokenExchange({ public_token: publicToken });
      this.#config!.accessToken = response.access_token;
      return ok({ accessToken: response.access_token, itemId: response.item_id });
    }, 'PLAID_EXCHANGE_TOKEN_FAILED');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #buildClient(config: PlaidConfig): IPlaidClient {
    if (this.clientFactory) return this.clientFactory(config);
    return new DefaultPlaidClient(config);
  }

  async #fetchAccounts(): Promise<{ fetched: number; records: PlaidAccount[]; errors: AdapterError[] }> {
    const records: PlaidAccount[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.accountsGet({
        access_token: this.#config!.accessToken!,
      });
      for (const raw of response.accounts) {
        records.push(mapAccount(raw, 'unknown', 'Unknown Institution'));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'PLAID_ACCOUNTS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }

  async #fetchTransactions(
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<{ fetched: number; records: PlaidTransaction[]; errors: AdapterError[] }> {
    const records: PlaidTransaction[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.transactionsGet({
        access_token: this.#config!.accessToken!,
        start_date: startDate,
        end_date: endDate,
        count: Math.min(limit, 500),
        offset: 0,
      });

      for (const raw of response.transactions) {
        records.push(mapTransaction(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'PLAID_TRANSACTIONS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

function mapAccount(raw: RawPlaidAccount, institutionId: string, institutionName: string): PlaidAccount {
  return {
    accountId: raw.account_id,
    institutionId,
    institutionName,
    name: raw.name,
    officialName: raw.official_name,
    type: raw.type as PlaidAccount['type'],
    subtype: raw.subtype as PlaidAccount['subtype'],
    balanceCurrent: raw.balances.current,
    balanceAvailable: raw.balances.available,
    balanceLimit: raw.balances.limit,
    currencyCode: raw.balances.iso_currency_code ?? 'USD',
    mask: raw.mask,
  };
}

function mapTransaction(raw: RawPlaidTransaction): PlaidTransaction {
  return {
    transactionId: raw.transaction_id,
    accountId: raw.account_id,
    amount: raw.amount,
    isoCurrencyCode: raw.iso_currency_code,
    date: raw.date,
    name: raw.name,
    merchantName: raw.merchant_name,
    paymentChannel: raw.payment_channel as PlaidTransaction['paymentChannel'],
    pending: raw.pending,
    category: raw.category,
    categoryId: raw.category_id,
    type: raw.transaction_type as PlaidTransaction['type'],
    transactionCode: raw.transaction_code,
  };
}

// ─── Default runtime client (thin plaid-node wrapper) ────────────────────────

class DefaultPlaidClient implements IPlaidClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #client: any;

  constructor(config: PlaidConfig) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');
      const configuration = new Configuration({
        basePath: PlaidEnvironments[config.environment],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': config.clientId,
            'PLAID-SECRET': config.secret,
          },
        },
      });
      this.#client = new PlaidApi(configuration);
    } catch {
      throw new Error('The "plaid" package is required. Install it: pnpm add plaid');
    }
  }

  async institutionsGet(params: { count: number; offset: number; country_codes: string[] }) {
    const response = await this.#client.institutionsGet({
      count: params.count,
      offset: params.offset,
      country_codes: params.country_codes,
    });
    return response.data as { institutions: Array<{ institution_id: string; name: string }> };
  }

  async linkTokenCreate(params: PlaidLinkTokenRequest) {
    const response = await this.#client.linkTokenCreate({
      user: { client_user_id: params.userId },
      client_name: params.clientName,
      products: params.products,
      country_codes: params.countryCodes,
      language: params.language,
    });
    return response.data as { link_token: string; expiration: string; request_id: string };
  }

  async itemPublicTokenExchange(params: { public_token: string }) {
    const response = await this.#client.itemPublicTokenExchange(params);
    return response.data as { access_token: string; item_id: string };
  }

  async accountsGet(params: { access_token: string }) {
    const response = await this.#client.accountsGet(params);
    return response.data as { accounts: RawPlaidAccount[] };
  }

  async transactionsGet(params: {
    access_token: string;
    start_date: string;
    end_date: string;
    count?: number;
    offset?: number;
  }) {
    const response = await this.#client.transactionsGet(params);
    return response.data as { transactions: RawPlaidTransaction[]; total_transactions: number };
  }
}
