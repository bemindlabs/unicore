import { ConfigService } from '@nestjs/config';
import { ProviderFactoryService, ProviderUnavailableError } from './provider-factory.service';
import { ILlmProvider, LlmCompletionResult } from '../interfaces/llm-provider.interface';

const makeProvider = (
  id: string,
  overrides: Partial<ILlmProvider> = {},
): ILlmProvider => ({
  providerId: id,
  complete: jest.fn(),
  stream: jest.fn(),
  embed: jest.fn(),
  healthCheck: jest.fn(),
  ...overrides,
});

const makeConfig = (env: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string, defaultVal?: unknown) => env[key] ?? defaultVal),
  }) as unknown as ConfigService;

describe('ProviderFactoryService', () => {
  const mockResult: LlmCompletionResult = {
    content: 'hello',
    model: 'gpt-4o',
    provider: 'openai',
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    finishReason: 'stop',
    latencyMs: 100,
  };

  describe('completeWithFailover()', () => {
    it('returns result from primary provider on success', async () => {
      const factory = new ProviderFactoryService(
        makeConfig({
          LLM_PRIMARY_PROVIDER: 'openai',
          LLM_FAILOVER_PROVIDERS: '',
          LLM_FAILOVER_ENABLED: 'false',
        }),
      );
      factory.onModuleInit();

      // Replace the real OpenAI provider with a mock
      const mockProvider = makeProvider('openai', {
        complete: jest.fn().mockResolvedValue(mockResult),
      });
      (factory as unknown as { registry: Map<string, ILlmProvider> }).registry.set(
        'openai',
        mockProvider,
      );

      const result = await factory.completeWithFailover([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result.content).toBe('hello');
      expect(mockProvider.complete).toHaveBeenCalledTimes(1);
    });

    it('falls over to second provider when primary fails', async () => {
      const factory = new ProviderFactoryService(
        makeConfig({
          LLM_PRIMARY_PROVIDER: 'openai',
          LLM_FAILOVER_PROVIDERS: 'anthropic',
          LLM_FAILOVER_ENABLED: 'true',
        }),
      );
      factory.onModuleInit();

      const registry = (factory as unknown as { registry: Map<string, ILlmProvider> }).registry;

      const anthropicResult = { ...mockResult, provider: 'anthropic' };

      registry.set(
        'openai',
        makeProvider('openai', {
          complete: jest.fn().mockRejectedValue(new Error('rate limited')),
        }),
      );
      registry.set(
        'anthropic',
        makeProvider('anthropic', {
          complete: jest.fn().mockResolvedValue(anthropicResult),
        }),
      );

      const result = await factory.completeWithFailover([
        { role: 'user', content: 'Hi' },
      ]);

      expect(result.provider).toBe('anthropic');
    });

    it('throws ProviderUnavailableError when all providers fail', async () => {
      const factory = new ProviderFactoryService(
        makeConfig({
          LLM_PRIMARY_PROVIDER: 'openai',
          LLM_FAILOVER_PROVIDERS: '',
          LLM_FAILOVER_ENABLED: 'false',
        }),
      );
      factory.onModuleInit();

      const registry = (factory as unknown as { registry: Map<string, ILlmProvider> }).registry;
      registry.set(
        'openai',
        makeProvider('openai', {
          complete: jest.fn().mockRejectedValue(new Error('Service down')),
        }),
      );

      await expect(
        factory.completeWithFailover([{ role: 'user', content: 'Hi' }]),
      ).rejects.toThrow(ProviderUnavailableError);
    });
  });

  describe('per-tenant key resolution (GAPS #2)', () => {
    afterEach(() => jest.restoreAllMocks());

    it('fetches keys scoped to the calling tenant (forwards x-tenant-id)', async () => {
      const factory = new ProviderFactoryService(
        makeConfig({
          API_GATEWAY_URL: 'http://gw:4000',
          LLM_FAILOVER_ENABLED: 'false',
          LLM_PRIMARY_PROVIDER: 'openai',
        }),
      );

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockImplementation((_url, init) => {
          const tenant = (init?.headers as Record<string, string>)['x-tenant-id'];
          // Each tenant has its own key so we can assert isolation.
          const openaiKey = tenant === 'tenant-a' ? 'sk-a' : 'sk-b';
          return Promise.resolve(
            new Response(JSON.stringify({ openaiKey, defaultProvider: 'openai' }), { status: 200 }),
          );
        });

      // Calling for tenant-a builds tenant-a's registry from tenant-a's keys.
      await factory.completeWithFailover(
        [{ role: 'user', content: 'Hi' }],
        undefined,
        undefined,
        'tenant-a',
      ).catch(() => undefined); // provider.complete will fail (fake key) — we only assert the fetch

      const call = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes('/api/v1/settings/ai-config/keys'),
      );
      expect(call).toBeDefined();
      expect((call![1]!.headers as Record<string, string>)['x-tenant-id']).toBe('tenant-a');
    });

    it('does NOT prefetch any tenant keys at startup (no x-tenant-id on init)', async () => {
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response('{}', { status: 200 }));

      const factory = new ProviderFactoryService(
        makeConfig({ LLM_FAILOVER_ENABLED: 'false' }),
      );
      await factory.onModuleInit();

      // Startup must not call the keys endpoint with (or without) a tenant header.
      const keyCalls = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes('/api/v1/settings/ai-config/keys'),
      );
      expect(keyCalls).toHaveLength(0);
    });
  });

  describe('listProviders()', () => {
    it('exposes only the three wired providers (openai, anthropic, ollama)', () => {
      const factory = new ProviderFactoryService(
        makeConfig({ LLM_FAILOVER_ENABLED: 'false' }),
      );

      const ids = factory.listProviders().map((p) => p.id);

      expect(ids).toEqual(['openai', 'anthropic', 'ollama']);
      // Roadmap providers must not be surfaced until their adapters are wired.
      for (const roadmap of [
        'deepseek', 'groq', 'gemini', 'moonshot', 'mistral',
        'xai', 'openrouter', 'together', 'fireworks', 'cohere',
      ]) {
        expect(ids).not.toContain(roadmap);
      }
    });
  });

  describe('checkAllHealth()', () => {
    it('calls healthCheck on all registered providers', async () => {
      const factory = new ProviderFactoryService(
        makeConfig({ LLM_FAILOVER_ENABLED: 'false' }),
      );
      factory.onModuleInit();

      const registry = (factory as unknown as { registry: Map<string, ILlmProvider> }).registry;
      const mockProvider = makeProvider('ollama', {
        healthCheck: jest.fn().mockResolvedValue({
          provider: 'ollama',
          healthy: true,
          checkedAt: new Date(),
        }),
      });
      registry.clear();
      registry.set('ollama', mockProvider);

      const results = await factory.checkAllHealth();

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('ollama');
      expect(results[0].healthy).toBe(true);
    });
  });
});
