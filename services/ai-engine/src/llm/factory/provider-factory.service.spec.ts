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
          OPENAI_API_KEY: 'sk-test',
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
