// TikTok Adapter tests — @bemindlabs/unicore-integrations

import { TiktokAdapter } from '../src/adapters/tiktok/index';
import type { ITiktokClient } from '../src/adapters/tiktok/index';
import type { TiktokConfig } from '../src/types/tiktok';

// ─── Mock client ──────────────────────────────────────────────────────────────

function createMockClient(overrides?: Partial<ITiktokClient>): ITiktokClient {
  return {
    getAdvertiserInfo: jest.fn().mockResolvedValue({
      advertiser_id: 'adv-001',
      name: 'Test Advertiser',
      status: 'STATUS_ENABLE',
    }),
    listCampaigns: jest.fn().mockResolvedValue({
      list: [
        {
          campaign_id: 'camp-001',
          campaign_name: 'Summer Sale',
          objective_type: 'TRAFFIC',
          status: 'ENABLE',
          budget_mode: 'BUDGET_MODE_DAY',
          budget: 5000,
          create_time: '2026-03-01T00:00:00Z',
          modify_time: '2026-03-10T00:00:00Z',
        },
      ],
      page_info: { page: 1, page_size: 100, total_number: 1, total_page: 1 },
    }),
    listAdGroups: jest.fn().mockResolvedValue({
      list: [
        {
          adgroup_id: 'adg-001',
          campaign_id: 'camp-001',
          adgroup_name: 'Youth Audience',
          status: 'ENABLE',
          budget: 2000,
          bid_price: 1.5,
          create_time: '2026-03-01T00:00:00Z',
          modify_time: '2026-03-10T00:00:00Z',
        },
      ],
      page_info: { page: 1, page_size: 100, total_number: 1, total_page: 1 },
    }),
    listAds: jest.fn().mockResolvedValue({
      list: [
        {
          ad_id: 'ad-001',
          adgroup_id: 'adg-001',
          campaign_id: 'camp-001',
          ad_name: 'Video Ad 1',
          status: 'ENABLE',
          ad_text: 'Check out our summer sale!',
          call_to_action: 'SHOP_NOW',
          create_time: '2026-03-02T00:00:00Z',
          modify_time: '2026-03-10T00:00:00Z',
        },
      ],
      page_info: { page: 1, page_size: 100, total_number: 1, total_page: 1 },
    }),
    ...overrides,
  };
}

const VALID_CONFIG: TiktokConfig = {
  accessToken: 'test-access-token',
  advertiserId: 'adv-001',
};

describe('TiktokAdapter', () => {
  let adapter: TiktokAdapter;
  let mockClient: ITiktokClient;

  beforeEach(() => {
    mockClient = createMockClient();
    adapter = new TiktokAdapter(() => mockClient);
  });

  // ─── meta ───────────────────────────────────────────────────────────────────

  it('exposes correct metadata', () => {
    expect(adapter.meta).toEqual({
      id: 'tiktok',
      name: 'TikTok Ads',
      description: 'Sync ad campaigns, ad groups, and ads from TikTok Marketing API.',
      version: '0.1.0',
      category: 'custom',
    });
  });

  // ─── connect ────────────────────────────────────────────────────────────────

  it('connects successfully with valid config', async () => {
    const result = await adapter.connect(VALID_CONFIG);

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('connected');
    expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockClient.getAdvertiserInfo).toHaveBeenCalledTimes(1);
  });

  it('fails to connect when accessToken is missing', async () => {
    const result = await adapter.connect({ accessToken: '', advertiserId: 'adv-001' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CONFIG');
  });

  it('fails to connect when advertiserId is missing', async () => {
    const result = await adapter.connect({ accessToken: 'token', advertiserId: '' });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_CONFIG');
  });

  it('wraps API errors during connect', async () => {
    mockClient = createMockClient({
      getAdvertiserInfo: jest.fn().mockRejectedValue(new Error('Unauthorized')),
    });
    adapter = new TiktokAdapter(() => mockClient);

    const result = await adapter.connect(VALID_CONFIG);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Unauthorized');
  });

  // ─── disconnect ─────────────────────────────────────────────────────────────

  it('disconnects cleanly', async () => {
    await adapter.connect(VALID_CONFIG);
    const result = await adapter.disconnect();

    expect(result.success).toBe(true);

    const status = await adapter.getStatus();
    expect(status.status).toBe('disconnected');
  });

  // ─── getStatus ──────────────────────────────────────────────────────────────

  it('returns disconnected before connect', async () => {
    const status = await adapter.getStatus();
    expect(status.status).toBe('disconnected');
  });

  it('returns connected after successful connect', async () => {
    await adapter.connect(VALID_CONFIG);
    const status = await adapter.getStatus();

    expect(status.status).toBe('connected');
    expect(status.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error status when API fails', async () => {
    await adapter.connect(VALID_CONFIG);

    (mockClient.getAdvertiserInfo as jest.Mock).mockRejectedValueOnce(
      new Error('Rate limited'),
    );
    const status = await adapter.getStatus();

    expect(status.status).toBe('error');
    expect(status.message).toContain('Rate limited');
  });

  // ─── sync ───────────────────────────────────────────────────────────────────

  it('fails sync when not connected', async () => {
    const result = await adapter.sync();

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_CONNECTED');
  });

  it('syncs campaigns, ad groups, and ads', async () => {
    await adapter.connect(VALID_CONFIG);
    const result = await adapter.sync();

    expect(result.success).toBe(true);
    expect(result.data?.recordsFetched).toBe(3); // 1 campaign + 1 ad group + 1 ad
    expect(result.data?.recordsCreated).toBe(3);
    expect(result.data?.recordsFailed).toBe(0);
    expect(result.data?.direction).toBe('inbound');
  });

  it('respects limit option', async () => {
    await adapter.connect(VALID_CONFIG);
    await adapter.sync({ limit: 10 });

    expect(mockClient.listCampaigns).toHaveBeenCalledWith({ page_size: 10 });
    expect(mockClient.listAdGroups).toHaveBeenCalledWith({ page_size: 10 });
    expect(mockClient.listAds).toHaveBeenCalledWith({ page_size: 10 });
  });

  it('caps limit at 100', async () => {
    await adapter.connect(VALID_CONFIG);
    await adapter.sync({ limit: 500 });

    expect(mockClient.listCampaigns).toHaveBeenCalledWith({ page_size: 100 });
  });

  it('collects partial errors during sync', async () => {
    (mockClient.listAdGroups as jest.Mock).mockRejectedValueOnce(
      new Error('Ad group fetch failed'),
    );

    await adapter.connect(VALID_CONFIG);
    const result = await adapter.sync();

    expect(result.success).toBe(true);
    expect(result.data?.recordsFetched).toBe(2); // campaigns + ads only
    expect(result.data?.recordsFailed).toBe(1);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0].code).toBe('TIKTOK_LIST_ADGROUPS_FAILED');
  });
});
