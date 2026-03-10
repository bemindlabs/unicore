import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  ILlmProvider,
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmEmbeddingOptions,
  LlmEmbeddingResult,
  LlmMessage,
  LlmStreamChunk,
  ProviderHealthStatus,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class AnthropicProvider implements ILlmProvider {
  readonly providerId = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(apiKey: string, defaultModel = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): Promise<LlmCompletionResult> {
    const start = Date.now();
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`Anthropic completion: model=${model}`);

    // Extract system message (Anthropic uses a top-level system param)
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model,
      system: systemMessage?.content,
      messages: chatMessages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      top_p: options.topP,
      stop_sequences: options.stop,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      model: response.model,
      provider: this.providerId,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'stop',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): AsyncGenerator<LlmStreamChunk> {
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`Anthropic stream: model=${model}`);

    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = this.client.messages.stream({
      model,
      system: systemMessage?.content,
      messages: chatMessages,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature,
      top_p: options.topP,
      stop_sequences: options.stop,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield {
          delta: event.delta.text,
          done: false,
          provider: this.providerId,
        };
      } else if (event.type === 'message_delta' && event.usage) {
        // Final message event with usage data
        yield {
          delta: '',
          done: true,
          model,
          provider: this.providerId,
          usage: {
            promptTokens: 0,
            completionTokens: event.usage.output_tokens,
            totalTokens: event.usage.output_tokens,
          },
        };
      } else if (event.type === 'message_stop') {
        const finalMessage = await stream.finalMessage();
        yield {
          delta: '',
          done: true,
          model: finalMessage.model,
          provider: this.providerId,
          usage: {
            promptTokens: finalMessage.usage.input_tokens,
            completionTokens: finalMessage.usage.output_tokens,
            totalTokens:
              finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
          },
        };
        break;
      }
    }
  }

  async embed(
    _text: string,
    _options: LlmEmbeddingOptions = {},
  ): Promise<LlmEmbeddingResult> {
    // Anthropic does not provide a public embedding API.
    // Throw to trigger failover to a provider that supports embeddings.
    throw new Error(
      'Anthropic does not support embeddings. Use OpenAI or Ollama for embedding operations.',
    );
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      // Use a minimal completion as the health probe
      await this.client.messages.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      });
      return {
        provider: this.providerId,
        healthy: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Anthropic health check failed: ${error}`);
      return {
        provider: this.providerId,
        healthy: false,
        error,
        checkedAt: new Date(),
      };
    }
  }
}
