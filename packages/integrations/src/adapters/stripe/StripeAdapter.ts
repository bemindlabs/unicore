// Stripe Payment Adapter — @unicore/integrations
// Integrates with the Stripe API to sync payment intents and charges.

import type { IAdapter, AdapterMeta, AdapterHealth, AdapterResult, AdapterError, SyncOptions, SyncResult } from '../../types/adapter.js';
import type { StripeConfig, StripePaymentIntent, StripeCharge, StripeSyncData } from '../../types/stripe.js';
import { ok, okVoid, err, tryCatch, toAdapterError } from '../../utils/result.js';
import { validateRequiredFields } from '../../utils/validation.js';

const META: AdapterMeta = {
  id: 'stripe',
  name: 'Stripe',
  description: 'Sync payment intents and charges from Stripe.',
  version: '0.1.0',
  category: 'payment',
};

/**
 * Minimal HTTP client wrapper so the adapter remains testable without
 * importing a full Stripe SDK (which is an optional peer dependency).
 * In production the caller can inject a pre-authenticated Stripe client.
 */
export interface IStripeClient {
  listPaymentIntents(params: {
    created?: { gte?: number };
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: RawStripePaymentIntent[]; has_more: boolean }>;

  listCharges(params: {
    created?: { gte?: number };
    limit?: number;
    starting_after?: string;
  }): Promise<{ data: RawStripeCharge[]; has_more: boolean }>;

  /** Retrieve account info to validate the key. */
  retrieveAccount(): Promise<{ id: string }>;
}

// ─── Raw Stripe API shapes (minimal subset we care about) ────────────────────

interface RawStripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer?: string | null;
  description?: string | null;
  metadata: Record<string, string>;
  created: number;
}

interface RawStripeCharge {
  id: string;
  payment_intent?: string | null;
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  failure_code?: string | null;
  failure_message?: string | null;
  receipt_url?: string | null;
  created: number;
}

// ─── Stripe Adapter ──────────────────────────────────────────────────────────

export class StripeAdapter implements IAdapter<StripeConfig, StripeSyncData> {
  readonly meta: AdapterMeta = META;

  #config: StripeConfig | null = null;
  #client: IStripeClient | null = null;
  #lastCheckedAt = new Date().toISOString();

  /** Allow injection of a pre-built client (used in tests). */
  constructor(private readonly clientFactory?: (config: StripeConfig) => IStripeClient) {}

  // ─── connect ──────────────────────────────────────────────────────────────

  async connect(config: StripeConfig): Promise<AdapterResult<AdapterHealth>> {
    const validationError = validateRequiredFields(config, ['secretKey']);
    if (validationError) return err<AdapterHealth>(validationError);

    return tryCatch(async () => {
      const client = this.#buildClient(config);
      const start = Date.now();
      await client.retrieveAccount();
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
    }, 'STRIPE_CONNECT_FAILED');
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
    if (!this.#client || !this.#config) {
      return { status: 'disconnected', lastCheckedAt: this.#lastCheckedAt };
    }

    try {
      const start = Date.now();
      await this.#client.retrieveAccount();
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
    if (!this.#client) {
      return err<SyncResult>({
        code: 'NOT_CONNECTED',
        message: 'Call connect() before sync().',
        retryable: false,
      });
    }

    return tryCatch(async () => {
      const createdGte = options?.since
        ? Math.floor(new Date(options.since).getTime() / 1000)
        : undefined;
      const limit = Math.min(options?.limit ?? 100, 100);

      const [intentResult, chargeResult] = await Promise.all([
        this.#fetchPaymentIntents(createdGte, limit),
        this.#fetchCharges(createdGte, limit),
      ]);

      const allErrors = [...intentResult.errors, ...chargeResult.errors];

      const result: SyncResult = {
        direction: 'inbound',
        recordsFetched: intentResult.fetched + chargeResult.fetched,
        recordsCreated: intentResult.fetched + chargeResult.fetched,
        recordsUpdated: 0,
        recordsFailed: allErrors.length,
        errors: allErrors,
        syncedAt: new Date().toISOString(),
      };

      return ok<SyncResult>(result);
    }, 'STRIPE_SYNC_FAILED');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #buildClient(config: StripeConfig): IStripeClient {
    if (this.clientFactory) return this.clientFactory(config);
    return new DefaultStripeClient(config.secretKey, config.apiVersion);
  }

  async #fetchPaymentIntents(
    createdGte: number | undefined,
    limit: number,
  ): Promise<{ fetched: number; records: StripePaymentIntent[]; errors: AdapterError[] }> {
    const records: StripePaymentIntent[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.listPaymentIntents({
        ...(createdGte !== undefined && { created: { gte: createdGte } }),
        limit,
      });

      for (const raw of response.data) {
        records.push(mapPaymentIntent(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'STRIPE_LIST_PAYMENT_INTENTS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }

  async #fetchCharges(
    createdGte: number | undefined,
    limit: number,
  ): Promise<{ fetched: number; records: StripeCharge[]; errors: AdapterError[] }> {
    const records: StripeCharge[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.listCharges({
        ...(createdGte !== undefined && { created: { gte: createdGte } }),
        limit,
      });

      for (const raw of response.data) {
        records.push(mapCharge(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'STRIPE_LIST_CHARGES_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

function mapPaymentIntent(raw: RawStripePaymentIntent): StripePaymentIntent {
  return {
    id: raw.id,
    amount: raw.amount,
    currency: raw.currency,
    status: raw.status as StripePaymentIntent['status'],
    customerId: raw.customer ?? undefined,
    description: raw.description ?? undefined,
    metadata: raw.metadata,
    createdAt: new Date(raw.created * 1000).toISOString(),
    updatedAt: new Date(raw.created * 1000).toISOString(),
  };
}

function mapCharge(raw: RawStripeCharge): StripeCharge {
  return {
    id: raw.id,
    paymentIntentId: raw.payment_intent ?? '',
    amount: raw.amount,
    amountRefunded: raw.amount_refunded,
    currency: raw.currency,
    status: raw.status as StripeCharge['status'],
    failureCode: raw.failure_code ?? undefined,
    failureMessage: raw.failure_message ?? undefined,
    receiptUrl: raw.receipt_url ?? undefined,
    createdAt: new Date(raw.created * 1000).toISOString(),
  };
}

// ─── Default runtime client (thin Stripe SDK wrapper) ────────────────────────

class DefaultStripeClient implements IStripeClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #stripe: any;

  constructor(secretKey: string, apiVersion?: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Stripe = require('stripe');
      this.#stripe = new Stripe(secretKey, {
        apiVersion: apiVersion ?? '2024-06-20',
        typescript: true,
      });
    } catch {
      throw new Error(
        'The "stripe" package is required. Install it: pnpm add stripe',
      );
    }
  }

  async listPaymentIntents(params: {
    created?: { gte?: number };
    limit?: number;
    starting_after?: string;
  }) {
    return this.#stripe.paymentIntents.list(params) as Promise<{
      data: RawStripePaymentIntent[];
      has_more: boolean;
    }>;
  }

  async listCharges(params: {
    created?: { gte?: number };
    limit?: number;
    starting_after?: string;
  }) {
    return this.#stripe.charges.list(params) as Promise<{
      data: RawStripeCharge[];
      has_more: boolean;
    }>;
  }

  async retrieveAccount() {
    return this.#stripe.accounts.retrieve() as Promise<{ id: string }>;
  }
}
