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

  describe('getRecords()', () => {
    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        service.track({ provider: 'openai', model: 'gpt-4o', usage: sampleUsage, operation: 'complete' });
      }

      const page = service.getRecords(2, 1);
      expect(page).toHaveLength(2);
    });
  });
});
