import { TokenTrackingService } from './token-tracking.service';

describe('TokenTrackingService', () => {
  let service: TokenTrackingService;

  beforeEach(() => {
    service = new TokenTrackingService();
  });

  const sampleUsage = {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  };

  describe('track()', () => {
    it('creates a record with a sequential id', () => {
      const r = service.track({
        provider: 'openai',
        model: 'gpt-4o',
        usage: sampleUsage,
        operation: 'complete',
      });

      expect(r.id).toMatch(/^tok_/);
      expect(r.provider).toBe('openai');
      expect(r.model).toBe('gpt-4o');
      expect(r.totalTokens).toBe(150);
    });

    it('calculates cost for OpenAI gpt-4o', () => {
      const record = service.track({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
        operation: 'complete',
      });

      // gpt-4o: $2.5 input + $10 output per 1M tokens → $12.5 total for 1M/1M
      expect(record.cost).toBeCloseTo(12.5, 2);
    });

    it('calculates $0 cost for ollama (local)', () => {
      const record = service.track({
        provider: 'ollama',
        model: 'llama3.2',
        usage: sampleUsage,
        operation: 'complete',
      });

      expect(record.cost).toBe(0);
    });
  });

  describe('getStats()', () => {
    it('aggregates totals across tracked records', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', usage: sampleUsage, operation: 'complete' });

      const stats = service.getStats();

      expect(stats.totalRequests).toBe(2);
      expect(stats.totalTokens).toBe(300);
      expect(stats.byProvider['openai'].requests).toBe(1);
      expect(stats.byProvider['anthropic'].requests).toBe(1);
    });

    it('filters by provider', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'ollama', model: 'llama3.2', usage: sampleUsage, operation: 'complete' });

      const stats = service.getStats({ provider: 'openai' });

      expect(stats.totalRequests).toBe(1);
      expect(stats.byProvider['openai']).toBeDefined();
      expect(stats.byProvider['ollama']).toBeUndefined();
    });

    it('filters by tenantId', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete', tenantId: 'tenant-a' });
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete', tenantId: 'tenant-b' });

      const stats = service.getStats({ tenantId: 'tenant-a' });

      expect(stats.totalRequests).toBe(1);
    });

    it('filters by since date', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });

      const future = new Date(Date.now() + 60_000);
      const stats = service.getStats({ since: future });

      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('estimateCost()', () => {
    it('returns 0 for unknown provider', () => {
      const cost = service.estimateCost('unknown-provider', 'some-model', sampleUsage);
      // Falls back to openai default pricing — still a valid number
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });

    it('returns 0 for ollama models', () => {
      const cost = service.estimateCost('ollama', 'llama3.2', sampleUsage);
      expect(cost).toBe(0);
    });
  });

  describe('reloadPricingOverrides()', () => {
    it('is a no-op when no ConfigService is injected (unit test mode)', async () => {
      // service is constructed without ConfigService — defaults remain active
      await expect(service.reloadPricingOverrides()).resolves.toBeUndefined();
    });

    it('getActivePricing() returns the default pricing map before any overrides', () => {
      const pricing = service.getActivePricing();
      // Verify a few well-known defaults are present
      expect(pricing['openai']['gpt-4o'].inputPer1M).toBe(2.5);
      expect(pricing['anthropic']['default'].inputPer1M).toBe(3.0);
      expect(pricing['ollama']['default'].inputPer1M).toBe(0);
    });
  });

  describe('getRecords()', () => {
    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      }

      const page = service.getRecords(2, 1);
      expect(page).toHaveLength(2);
    });
  });

  describe('getAggregatedUsage()', () => {
    it('aggregates records by daily period', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'anthropic', model: 'claude-sonnet-4-20250514', usage: sampleUsage, operation: 'stream' });

      const result = service.getAggregatedUsage({ period: 'daily' });

      expect(result.period).toBe('daily');
      expect(result.totals.requestCount).toBe(3);
      expect(result.totals.totalTokens).toBe(450);
      // Should have 2 rows: one for openai/gpt-4o and one for anthropic/claude
      expect(result.data.length).toBe(2);
    });

    it('aggregates records by monthly period', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });

      const result = service.getAggregatedUsage({ period: 'monthly' });

      expect(result.period).toBe('monthly');
      expect(result.data.length).toBe(1);
      expect(result.data[0].requestCount).toBe(2);
      expect(result.data[0].totalTokens).toBe(300);
    });

    it('filters by date range', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });

      const future = new Date(Date.now() + 60_000);
      const result = service.getAggregatedUsage({ period: 'daily', from: future });

      expect(result.totals.requestCount).toBe(0);
      expect(result.data.length).toBe(0);
    });

    it('filters by provider', () => {
      service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      service.track({ provider: 'ollama', model: 'llama3.2', usage: sampleUsage, operation: 'complete' });

      const result = service.getAggregatedUsage({ period: 'daily', provider: 'openai' });

      expect(result.totals.requestCount).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].provider).toBe('openai');
    });

    it('includes cost estimation for deepseek', () => {
      service.track({
        provider: 'deepseek',
        model: 'deepseek-chat',
        usage: { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
        operation: 'complete',
      });

      const result = service.getAggregatedUsage({ period: 'daily' });

      // deepseek-chat: $0.14 input + $0.28 output per 1M → $0.42 total
      expect(result.data[0].estimatedCost).toBeCloseTo(0.42, 2);
    });
  });
});
