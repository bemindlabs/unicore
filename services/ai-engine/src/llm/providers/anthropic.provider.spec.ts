import { AnthropicProvider } from './anthropic.provider';

const mockCreate = jest.fn().mockResolvedValue({
  id: 'msg_001',
  model: 'claude-3-5-sonnet-20241022',
  content: [{ type: 'text', text: 'Hello from Claude!' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 8, output_tokens: 5 },
});

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
        stream: jest.fn(),
      },
    })),
  };
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider('test-key');
  });

  it('should have providerId "anthropic"', () => {
    expect(provider.providerId).toBe('anthropic');
  });

  describe('complete()', () => {
    it('returns a LlmCompletionResult', async () => {
      const result = await provider.complete([
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Hello from Claude!');
      expect(result.provider).toBe('anthropic');
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(13);
    });

    it('extracts system message separately', async () => {
      await provider.complete([
        { role: 'system', content: 'You are a bot.' },
        { role: 'user', content: 'Hi' },
      ]);

      const call = mockCreate.mock.calls.at(-1)?.[0] as {
        system?: string;
        messages: Array<{ role: string }>;
      };
      expect(call.system).toBe('You are a bot.');
      expect(call.messages.every((m) => m.role !== 'system')).toBe(true);
    });
  });

  describe('embed()', () => {
    it('throws because Anthropic does not support embeddings', async () => {
      await expect(provider.embed('test')).rejects.toThrow(
        /does not support embeddings/i,
      );
    });
  });
});
