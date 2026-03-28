import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { ProviderFactoryService } from './factory/provider-factory.service';
import { TokenTrackingService } from '../token-tracking/token-tracking.service';
import {
  LlmCompletionResult,
  LlmEmbeddingResult,
  LlmStreamChunk,
  ProviderHealthStatus,
} from './interfaces/llm-provider.interface';

describe('LlmService', () => {
  let service: LlmService;

  const mockFactory = {
    completeWithFailover: jest.fn(),
    streamWithFailover: jest.fn(),
    embedWithFailover: jest.fn(),
    checkAllHealth: jest.fn(),
    reloadProviders: jest.fn(),
    listModels: jest.fn(),
  };

  const mockTokenTracking = {
    track: jest.fn(),
    reloadPricingOverrides: jest.fn(),
  };

  const fakeCompletion: LlmCompletionResult = {
    content: 'Hello!',
    model: 'gpt-4o',
    provider: 'openai',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
    latencyMs: 100,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: ProviderFactoryService, useValue: mockFactory },
        { provide: TokenTrackingService, useValue: mockTokenTracking },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    mockFactory.completeWithFailover.mockResolvedValue(fakeCompletion);
    mockTokenTracking.track.mockReturnValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('complete()', () => {
    it('delegates to factory.completeWithFailover and tracks usage', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const result = await service.complete(messages);

      expect(mockFactory.completeWithFailover).toHaveBeenCalledWith(
        messages,
        undefined,
        undefined,
      );
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          operation: 'complete',
        }),
      );
      expect(result).toEqual(fakeCompletion);
    });

    it('passes through preferred provider from context', async () => {
      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await service.complete(messages, {}, { preferredProvider: 'anthropic' });

      expect(mockFactory.completeWithFailover).toHaveBeenCalledWith(
        messages,
        {},
        'anthropic',
      );
    });

    it('passes tenantId and agentId to token tracking', async () => {
      const messages = [{ role: 'user' as const, content: 'Hi' }];
      await service.complete(messages, {}, { tenantId: 't1', agentId: 'a1' });

      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', agentId: 'a1' }),
      );
    });

    it('propagates errors from factory', async () => {
      mockFactory.completeWithFailover.mockRejectedValue(
        new Error('provider error'),
      );
      await expect(
        service.complete([{ role: 'user', content: 'test' }]),
      ).rejects.toThrow('provider error');
    });
  });

  describe('stream()', () => {
    it('yields chunks and tracks usage on done chunk', async () => {
      const chunks: LlmStreamChunk[] = [
        { delta: 'Hello', done: false, provider: 'openai' },
        {
          delta: '!',
          done: true,
          model: 'gpt-4o',
          provider: 'openai',
          usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
        },
      ];

      async function* fakeStream() {
        for (const c of chunks) yield c;
      }
      mockFactory.streamWithFailover.mockReturnValue(fakeStream());

      const messages = [{ role: 'user' as const, content: 'Hi' }];
      const received: LlmStreamChunk[] = [];
      for await (const chunk of service.stream(messages)) {
        received.push(chunk);
      }

      expect(received).toHaveLength(2);
      expect(mockTokenTracking.track).toHaveBeenCalledTimes(1);
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'stream', provider: 'openai' }),
      );
    });

    it('does not track if done chunk has no usage', async () => {
      async function* fakeStream() {
        yield { delta: 'Hi', done: true, provider: 'openai' };
      }
      mockFactory.streamWithFailover.mockReturnValue(fakeStream());

      for await (const _chunk of service.stream([
        { role: 'user', content: 'x' },
      ])) {
        // consume
      }

      expect(mockTokenTracking.track).not.toHaveBeenCalled();
    });
  });

  describe('embed()', () => {
    it('delegates to factory.embedWithFailover and tracks usage', async () => {
      const fakeEmbedding: LlmEmbeddingResult = {
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        provider: 'openai',
        usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
      };
      mockFactory.embedWithFailover.mockResolvedValue(fakeEmbedding);

      const result = await service.embed('hello world');

      expect(mockFactory.embedWithFailover).toHaveBeenCalledWith(
        'hello world',
        undefined,
        undefined,
      );
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'embed', provider: 'openai' }),
      );
      expect(result).toEqual(fakeEmbedding);
    });

    it('propagates errors from factory', async () => {
      mockFactory.embedWithFailover.mockRejectedValue(
        new Error('Embed failed'),
      );
      await expect(service.embed('text')).rejects.toThrow('Embed failed');
    });
  });

  describe('healthCheck()', () => {
    it('delegates to factory.checkAllHealth', async () => {
      const health: ProviderHealthStatus[] = [
        { provider: 'openai', healthy: true, checkedAt: new Date() },
        { provider: 'ollama', healthy: false, error: 'Connection refused', checkedAt: new Date() },
      ];
      mockFactory.checkAllHealth.mockResolvedValue(health);

      const result = await service.healthCheck();
      expect(result).toEqual(health);
      expect(mockFactory.checkAllHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('reloadProviders()', () => {
    it('delegates to factory.reloadProviders and reloads pricing overrides', async () => {
      mockFactory.reloadProviders.mockResolvedValue(['openai', 'ollama']);
      mockTokenTracking.reloadPricingOverrides.mockResolvedValue(undefined);

      const result = await service.reloadProviders();

      expect(result).toEqual(['openai', 'ollama']);
      expect(mockTokenTracking.reloadPricingOverrides).toHaveBeenCalledTimes(1);
    });
  });

  describe('listModels()', () => {
    it('delegates to factory.listModels', async () => {
      mockFactory.listModels.mockResolvedValue(['gpt-4o', 'gpt-4o-mini']);
      const result = await service.listModels();
      expect(result).toEqual(['gpt-4o', 'gpt-4o-mini']);
    });
  });
});
