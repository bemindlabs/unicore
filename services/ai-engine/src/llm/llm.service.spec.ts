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

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('complete()', () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];

    it('delegates to factory.completeWithFailover and returns result', async () => {
      const result = await service.complete(messages);
      expect(mockFactory.completeWithFailover).toHaveBeenCalledWith(messages, undefined, undefined);
      expect(result).toEqual(fakeCompletion);
    });

    it('tracks token usage after completion', async () => {
      await service.complete(messages);
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-4o',
          operation: 'complete',
          usage: fakeCompletion.usage,
          latencyMs: fakeCompletion.latencyMs,
        }),
      );
    });

    it('passes preferredProvider from context to factory', async () => {
      await service.complete(messages, {}, { preferredProvider: 'anthropic' });
      expect(mockFactory.completeWithFailover).toHaveBeenCalledWith(
        messages,
        {},
        'anthropic',
      );
    });

    it('passes tenantId and agentId to token tracking', async () => {
      await service.complete(messages, {}, { tenantId: 'tenant-1', agentId: 'agent-1' });
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', agentId: 'agent-1' }),
      );
    });

    it('passes metadata from context to token tracking', async () => {
      const metadata = { source: 'chat-ui' };
      await service.complete(messages, {}, { metadata });
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });

    it('propagates factory errors', async () => {
      mockFactory.completeWithFailover.mockRejectedValueOnce(new Error('All providers failed'));
      await expect(service.complete(messages)).rejects.toThrow('All providers failed');
    });
  });

  describe('stream()', () => {
    const messages = [{ role: 'user' as const, content: 'Tell me a story' }];

    async function* makeStream(chunks: LlmStreamChunk[]) {
      for (const chunk of chunks) yield chunk;
    }

    it('yields all chunks from factory.streamWithFailover', async () => {
      const chunks: LlmStreamChunk[] = [
        { delta: 'Once', done: false },
        { delta: ' upon', done: false },
        { delta: ' a time', done: true, provider: 'openai', model: 'gpt-4o', usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 } },
      ];
      mockFactory.streamWithFailover.mockReturnValue(makeStream(chunks));

      const received: LlmStreamChunk[] = [];
      for await (const chunk of service.stream(messages)) {
        received.push(chunk);
      }

      expect(received).toHaveLength(3);
      expect(received[0]!.delta).toBe('Once');
      expect(received[2]!.done).toBe(true);
    });

    it('tracks token usage from the final done chunk when usage is present', async () => {
      const doneChunk: LlmStreamChunk = {
        delta: '',
        done: true,
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 },
      };
      mockFactory.streamWithFailover.mockReturnValue(makeStream([
        { delta: 'hi', done: false },
        doneChunk,
      ]));

      for await (const _chunk of service.stream(messages)) { /* consume */ }

      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'stream',
          provider: 'openai',
          model: 'gpt-4o',
          usage: doneChunk.usage,
        }),
      );
    });

    it('does not track when done chunk has no usage', async () => {
      mockFactory.streamWithFailover.mockReturnValue(makeStream([
        { delta: 'hi', done: true }, // no usage field
      ]));

      for await (const _chunk of service.stream(messages)) { /* consume */ }

      expect(mockTokenTracking.track).not.toHaveBeenCalled();
    });

    it('uses "unknown" provider/model when done chunk omits them', async () => {
      mockFactory.streamWithFailover.mockReturnValue(makeStream([
        { delta: '', done: true, usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      ]));

      for await (const _chunk of service.stream(messages)) { /* consume */ }

      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'unknown', model: 'unknown' }),
      );
    });

    it('passes context fields to factory and token tracking', async () => {
      mockFactory.streamWithFailover.mockReturnValue(makeStream([
        { delta: '', done: true, provider: 'anthropic', model: 'claude-sonnet-4-20250514', usage: { promptTokens: 3, completionTokens: 3, totalTokens: 6 } },
      ]));

      for await (const _chunk of service.stream(
        messages,
        {},
        { preferredProvider: 'anthropic', tenantId: 'ten-1', agentId: 'ag-1' },
      )) { /* consume */ }

      expect(mockFactory.streamWithFailover).toHaveBeenCalledWith(messages, {}, 'anthropic');
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'ten-1', agentId: 'ag-1' }),
      );
    });
  });

  describe('embed()', () => {
    const fakeEmbedResult: LlmEmbeddingResult = {
      embedding: [0.1, 0.2, 0.3],
      model: 'text-embedding-3-small',
      provider: 'openai',
      usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
    };

    beforeEach(() => {
      mockFactory.embedWithFailover.mockResolvedValue(fakeEmbedResult);
    });

    it('delegates to factory.embedWithFailover and returns result', async () => {
      const result = await service.embed('hello world');
      expect(mockFactory.embedWithFailover).toHaveBeenCalledWith('hello world', undefined, undefined);
      expect(result).toEqual(fakeEmbedResult);
    });

    it('tracks embed usage', async () => {
      await service.embed('hello world');
      expect(mockTokenTracking.track).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'embed',
          provider: 'openai',
          model: 'text-embedding-3-small',
          usage: fakeEmbedResult.usage,
        }),
      );
    });

    it('passes preferredProvider to factory', async () => {
      await service.embed('text', { model: 'text-embedding-3-large' }, { preferredProvider: 'openai' });
      expect(mockFactory.embedWithFailover).toHaveBeenCalledWith(
        'text',
        { model: 'text-embedding-3-large' },
        'openai',
      );
    });

    it('propagates factory errors', async () => {
      mockFactory.embedWithFailover.mockRejectedValueOnce(new Error('Embed failed'));
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
    it('delegates to factory.reloadProviders', async () => {
      mockFactory.reloadProviders.mockResolvedValue(['openai', 'ollama']);
      const result = await service.reloadProviders();
      expect(result).toEqual(['openai', 'ollama']);
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
