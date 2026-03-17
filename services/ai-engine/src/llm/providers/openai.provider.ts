import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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
export class OpenAiProvider implements ILlmProvider {
  readonly providerId: string;
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly defaultEmbeddingModel: string;

  constructor(
    apiKey: string,
    defaultModel = 'gpt-4o',
    defaultEmbeddingModel = 'text-embedding-3-small',
    baseURL?: string,
    authType: 'api-key' | 'oauth' = 'api-key',
    providerId = 'openai',
  ) {
    this.providerId = providerId;
    if (authType === 'oauth') {
      // OAuth: use the token as a Bearer token, no API key
      this.client = new OpenAI({
        apiKey: '',
        baseURL: baseURL ?? 'https://api.openai.com/v1',
        defaultHeaders: { Authorization: `Bearer ${apiKey}` },
      });
    } else {
      this.client = new OpenAI({ apiKey, baseURL });
    }
    this.defaultModel = defaultModel;
    this.defaultEmbeddingModel = defaultEmbeddingModel;
  }

  async complete(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): Promise<LlmCompletionResult> {
    const start = Date.now();
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`OpenAI completion: model=${model}`);

    const response = await this.client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
      },
      { timeout: options.timeoutMs ?? 30_000 },
    );

    const choice = response.choices[0];
    const usage = response.usage;

    return {
      content: choice?.message?.content ?? '',
      model: response.model,
      provider: this.providerId,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
      finishReason: choice?.finish_reason ?? 'stop',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): AsyncGenerator<LlmStreamChunk> {
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`OpenAI stream: model=${model}`);

    const stream = await this.client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        stream: true,
        stream_options: { include_usage: true },
      },
      { timeout: options.timeoutMs ?? 60_000 },
    );

    let finalUsage: LlmStreamChunk['usage'] | undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const done = chunk.choices[0]?.finish_reason != null;

      if (chunk.usage) {
        finalUsage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }

      yield {
        delta,
        done,
        model: chunk.model,
        provider: this.providerId,
        usage: done ? finalUsage : undefined,
      };

      if (done) break;
    }
  }

  async embed(
    text: string,
    options: LlmEmbeddingOptions = {},
  ): Promise<LlmEmbeddingResult> {
    const model = options.model ?? this.defaultEmbeddingModel;

    this.logger.debug(`OpenAI embed: model=${model}`);

    const response = await this.client.embeddings.create(
      {
        model,
        input: text,
        dimensions: options.dimensions,
      },
      { timeout: options.timeoutMs ?? 15_000 },
    );

    const usage = response.usage;

    return {
      embedding: response.data[0]?.embedding ?? [],
      model: response.model,
      provider: this.providerId,
      usage: {
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      await this.client.models.list();
      return {
        provider: this.providerId,
        healthy: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OpenAI health check failed: ${error}`);
      return {
        provider: this.providerId,
        healthy: false,
        error,
        checkedAt: new Date(),
      };
    }
  }
}
