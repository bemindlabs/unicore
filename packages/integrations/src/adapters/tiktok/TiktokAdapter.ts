// TikTok Marketing API Adapter — @unicore/integrations
// Integrates with the TikTok Business API to sync ad campaigns, ad groups, and ads.

import type { IAdapter, AdapterMeta, AdapterHealth, AdapterResult, AdapterError, SyncOptions, SyncResult } from '../../types/adapter.js';
import type { TiktokConfig, TiktokCampaign, TiktokAdGroup, TiktokAd, TiktokSyncData } from '../../types/tiktok.js';
import { ok, okVoid, err, tryCatch, toAdapterError } from '../../utils/result.js';
import { validateRequiredFields } from '../../utils/validation.js';

const META: AdapterMeta = {
  id: 'tiktok',
  name: 'TikTok Ads',
  description: 'Sync ad campaigns, ad groups, and ads from TikTok Marketing API.',
  version: '0.1.0',
  category: 'custom',
};

const DEFAULT_BASE_URL = 'https://business-api.tiktok.com/open_api';
const DEFAULT_API_VERSION = 'v1.3';

/**
 * Minimal HTTP client interface so the adapter remains testable
 * without making real API calls.
 */
export interface ITiktokClient {
  getAdvertiserInfo(): Promise<RawAdvertiserInfo>;

  listCampaigns(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokCampaign>>;

  listAdGroups(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokAdGroup>>;

  listAds(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokAd>>;
}

// ─── Raw TikTok API shapes (minimal subset) ──────────────────────────────────

interface RawAdvertiserInfo {
  advertiser_id: string;
  name: string;
  status: string;
}

interface RawTiktokListResponse<T> {
  list: T[];
  page_info: { page: number; page_size: number; total_number: number; total_page: number };
}

interface RawTiktokCampaign {
  campaign_id: string;
  campaign_name: string;
  objective_type: string;
  status: string;
  budget_mode: string;
  budget: number;
  create_time: string;
  modify_time: string;
}

interface RawTiktokAdGroup {
  adgroup_id: string;
  campaign_id: string;
  adgroup_name: string;
  status: string;
  budget: number;
  bid_price: number;
  create_time: string;
  modify_time: string;
}

interface RawTiktokAd {
  ad_id: string;
  adgroup_id: string;
  campaign_id: string;
  ad_name: string;
  status: string;
  ad_text: string;
  call_to_action?: string;
  create_time: string;
  modify_time: string;
}

// ─── TikTok Adapter ─────────────────────────────────────────────────────────

export class TiktokAdapter implements IAdapter<TiktokConfig, TiktokSyncData> {
  readonly meta: AdapterMeta = META;

  #config: TiktokConfig | null = null;
  #client: ITiktokClient | null = null;
  #lastCheckedAt = new Date().toISOString();

  constructor(private readonly clientFactory?: (config: TiktokConfig) => ITiktokClient) {}

  // ─── connect ──────────────────────────────────────────────────────────────

  async connect(config: TiktokConfig): Promise<AdapterResult<AdapterHealth>> {
    const validationError = validateRequiredFields(config, ['accessToken', 'advertiserId']);
    if (validationError) return err<AdapterHealth>(validationError);

    return tryCatch(async () => {
      const client = this.#buildClient(config);
      const start = Date.now();
      await client.getAdvertiserInfo();
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
    }, 'TIKTOK_CONNECT_FAILED');
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
      await this.#client.getAdvertiserInfo();
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
      const pageSize = Math.min(options?.limit ?? 100, 100);

      const [campaignResult, adGroupResult, adResult] = await Promise.all([
        this.#fetchCampaigns(pageSize),
        this.#fetchAdGroups(pageSize),
        this.#fetchAds(pageSize),
      ]);

      const allErrors = [
        ...campaignResult.errors,
        ...adGroupResult.errors,
        ...adResult.errors,
      ];

      const totalFetched =
        campaignResult.fetched + adGroupResult.fetched + adResult.fetched;

      const result: SyncResult = {
        direction: 'inbound',
        recordsFetched: totalFetched,
        recordsCreated: totalFetched,
        recordsUpdated: 0,
        recordsFailed: allErrors.length,
        errors: allErrors,
        syncedAt: new Date().toISOString(),
      };

      return ok<SyncResult>(result);
    }, 'TIKTOK_SYNC_FAILED');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  #buildClient(config: TiktokConfig): ITiktokClient {
    if (this.clientFactory) return this.clientFactory(config);
    return new DefaultTiktokClient(config);
  }

  async #fetchCampaigns(
    pageSize: number,
  ): Promise<{ fetched: number; records: TiktokCampaign[]; errors: AdapterError[] }> {
    const records: TiktokCampaign[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.listCampaigns({ page_size: pageSize });
      for (const raw of response.list) {
        records.push(mapCampaign(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'TIKTOK_LIST_CAMPAIGNS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }

  async #fetchAdGroups(
    pageSize: number,
  ): Promise<{ fetched: number; records: TiktokAdGroup[]; errors: AdapterError[] }> {
    const records: TiktokAdGroup[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.listAdGroups({ page_size: pageSize });
      for (const raw of response.list) {
        records.push(mapAdGroup(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'TIKTOK_LIST_ADGROUPS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }

  async #fetchAds(
    pageSize: number,
  ): Promise<{ fetched: number; records: TiktokAd[]; errors: AdapterError[] }> {
    const records: TiktokAd[] = [];
    const errors: AdapterError[] = [];

    try {
      const response = await this.#client!.listAds({ page_size: pageSize });
      for (const raw of response.list) {
        records.push(mapAd(raw));
      }
    } catch (thrown) {
      errors.push(toAdapterError(thrown, 'TIKTOK_LIST_ADS_FAILED', true));
    }

    return { fetched: records.length, records, errors };
  }
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

function mapCampaign(raw: RawTiktokCampaign): TiktokCampaign {
  return {
    id: raw.campaign_id,
    name: raw.campaign_name,
    objective: raw.objective_type as TiktokCampaign['objective'],
    status: raw.status as TiktokCampaign['status'],
    budgetMode: raw.budget_mode as TiktokCampaign['budgetMode'],
    budget: raw.budget,
    createdAt: raw.create_time,
    updatedAt: raw.modify_time,
  };
}

function mapAdGroup(raw: RawTiktokAdGroup): TiktokAdGroup {
  return {
    id: raw.adgroup_id,
    campaignId: raw.campaign_id,
    name: raw.adgroup_name,
    status: raw.status as TiktokAdGroup['status'],
    budget: raw.budget,
    bidPrice: raw.bid_price,
    createdAt: raw.create_time,
    updatedAt: raw.modify_time,
  };
}

function mapAd(raw: RawTiktokAd): TiktokAd {
  return {
    id: raw.ad_id,
    adGroupId: raw.adgroup_id,
    campaignId: raw.campaign_id,
    name: raw.ad_name,
    status: raw.status as TiktokAd['status'],
    adText: raw.ad_text,
    callToAction: raw.call_to_action,
    createdAt: raw.create_time,
    updatedAt: raw.modify_time,
  };
}

// ─── Default runtime client (fetch-based) ─────────────────────────────────────

class DefaultTiktokClient implements ITiktokClient {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #advertiserId: string;

  constructor(config: TiktokConfig) {
    const version = config.apiVersion ?? DEFAULT_API_VERSION;
    this.#baseUrl = `${config.apiBaseUrl ?? DEFAULT_BASE_URL}/${version}`;
    this.#accessToken = config.accessToken;
    this.#advertiserId = config.advertiserId;
  }

  async #request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.#baseUrl}${path}`);
    const body = { advertiser_id: this.#advertiserId, ...params };

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Access-Token': this.#accessToken,
        'Content-Type': 'application/json',
      },
      // TikTok API uses query params for GET requests
      ...(params && Object.keys(params).length > 0
        ? (() => {
            url.searchParams.set('advertiser_id', this.#advertiserId);
            for (const [key, val] of Object.entries(params)) {
              if (val !== undefined) {
                url.searchParams.set(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
              }
            }
            return {};
          })()
        : (() => {
            url.searchParams.set('advertiser_id', this.#advertiserId);
            return {};
          })()),
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as { code: number; message: string; data: T };
    if (json.code !== 0) {
      throw new Error(`TikTok API error ${json.code}: ${json.message}`);
    }

    return json.data;
  }

  async getAdvertiserInfo(): Promise<RawAdvertiserInfo> {
    const data = await this.#request<{ list: RawAdvertiserInfo[] }>(
      '/advertiser/info/',
      { advertiser_ids: [this.#advertiserId] },
    );
    if (!data.list || data.list.length === 0) {
      throw new Error('Advertiser not found');
    }
    return data.list[0];
  }

  async listCampaigns(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokCampaign>> {
    return this.#request<RawTiktokListResponse<RawTiktokCampaign>>(
      '/campaign/get/',
      params,
    );
  }

  async listAdGroups(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokAdGroup>> {
    return this.#request<RawTiktokListResponse<RawTiktokAdGroup>>(
      '/adgroup/get/',
      params,
    );
  }

  async listAds(params: {
    page?: number;
    page_size?: number;
    filtering?: Record<string, unknown>;
  }): Promise<RawTiktokListResponse<RawTiktokAd>> {
    return this.#request<RawTiktokListResponse<RawTiktokAd>>(
      '/ad/get/',
      params,
    );
  }
}
