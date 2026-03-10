import { OpenAiProvider } from './openai.provider';
import {
  LlmCompletionResult,
  LlmEmbeddingResult,
} from '../interfaces/llm-provider.interface';

const mockCompletionsCreate = jest.fn();
const mockEmbeddingsCreate = jest.fn();
const mockModelsList = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCompletionsCreate,
        },
      },
      embeddings: {
        create: mockEmbeddingsCreate,
      },
      models: {
        list: mockModelsList,
      },
    })),
  };
});

describe('OpenAiProvider', () => {
  let provider: OpenAiProvider;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }],
      model: 'gpt-4o',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 4, total_tokens: 4 },
    });

    mockModelsList.mockResolvedValue({ data: [] });

    provider = new OpenAiProvider('test-key', 'gpt-4o');
  });

  it('should have providerId "openai"', () => {
    expect(provider.providerId).toBe('openai');
  });

  describe('complete()', () => {
    it('returns a LlmCompletionResult', async () => {
      const result: LlmCompletionResult = await provider.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Hello!');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe('stop');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('forwards model override from options', async () => {
      await provider.complete([{ role: 'user', content: 'Hi' }], {
        model: 'gpt-4o-mini',
      });

      const callArg = mockCompletionsCreate.mock.calls.at(-1)?.[0] as {
        model: string;
      };
      expect(callArg.model).toBe('gpt-4o-mini');
    });

    it('forwards temperature option', async () => {
      await provider.complete([{ role: 'user', content: 'Hi' }], {
        temperature: 0.2,
      });

      const callArg = mockCompletionsCreate.mock.calls.at(-1)?.[0] as {
        temperature: number;
      };
      expect(callArg.temperature).toBe(0.2);
    });
  });

  describe('embed()', () => {
    it('returns a LlmEmbeddingResult', async () => {
      const result: LlmEmbeddingResult = await provider.embed('test text');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.provider).toBe('openai');
      expect(result.usage.promptTokens).toBe(4);
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy when models.list succeeds', async () => {
      const status = await provider.healthCheck();
      expect(status.healthy).toBe(true);
      expect(status.provider).toBe('openai');
    });

    it('returns unhealthy when models.list throws', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('Unauthorized'));
      const status = await provider.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.error).toContain('Unauthorized');
    });
  });
});
