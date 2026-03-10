import { OllamaProvider } from './ollama.provider';

// Mock axios before any imports that use it
const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: mockPost,
    get: mockGet,
  })),
}));

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OllamaProvider('http://localhost:11434', 'llama3.2');
  });

  it('should have providerId "ollama"', () => {
    expect(provider.providerId).toBe('ollama');
  });

  describe('complete()', () => {
    it('returns a LlmCompletionResult', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          model: 'llama3.2',
          message: { role: 'assistant', content: 'Hello from Ollama!' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 12,
          eval_count: 7,
        },
      });

      const result = await provider.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Hello from Ollama!');
      expect(result.provider).toBe('ollama');
      expect(result.usage.promptTokens).toBe(12);
      expect(result.usage.completionTokens).toBe(7);
    });

    it('passes stream: false for completion', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          model: 'llama3.2',
          message: { content: '' },
          done: true,
          prompt_eval_count: 0,
          eval_count: 0,
        },
      });

      await provider.complete([{ role: 'user', content: 'test' }]);

      const callArg = mockPost.mock.calls.at(-1)?.[1] as { stream: boolean };
      expect(callArg.stream).toBe(false);
    });
  });

  describe('embed()', () => {
    it('returns a LlmEmbeddingResult', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          model: 'llama3.2',
          embeddings: [[0.5, 0.6, 0.7]],
          prompt_eval_count: 3,
        },
      });

      const result = await provider.embed('test text');

      expect(result.embedding).toEqual([0.5, 0.6, 0.7]);
      expect(result.provider).toBe('ollama');
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy when GET /api/tags succeeds', async () => {
      mockGet.mockResolvedValueOnce({ data: { models: [] } });
      const status = await provider.healthCheck();
      expect(status.healthy).toBe(true);
    });

    it('returns unhealthy when request fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const status = await provider.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.error).toContain('ECONNREFUSED');
    });
  });
});
