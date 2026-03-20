import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
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

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  model: string;
  embeddings: number[][];
  prompt_eval_count?: number;
}

@Injectable()
export class OllamaProvider implements ILlmProvider {
  readonly providerId = 'ollama';
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly http: AxiosInstance;
  private readonly defaultModel: string;

  constructor(
    baseURL = 'http://localhost:11434',
    defaultModel = 'llama3.2',
    timeoutMs = 120_000,
    authToken?: string,
  ) {
    this.http = axios.create({
      baseURL,
      timeout: timeoutMs,
      ...(authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : {}),
    });
    this.defaultModel = defaultModel;
  }

  async complete(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): Promise<LlmCompletionResult> {
    const start = Date.now();
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`Ollama completion: model=${model}`);

    const response = await this.http.post<OllamaChatResponse>('/api/chat', {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: options.temperature,
        top_p: options.topP,
        num_predict: options.maxTokens,
        stop: options.stop,
      },
    });

    const data = response.data;
    const promptTokens = data.prompt_eval_count ?? 0;
    const completionTokens = data.eval_count ?? 0;

    return {
      content: data.message.content,
      model: data.model,
      provider: this.providerId,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: data.done_reason ?? 'stop',
      latencyMs: Date.now() - start,
    };
  }

  async *stream(
    messages: LlmMessage[],
    options: LlmCompletionOptions = {},
  ): AsyncGenerator<LlmStreamChunk> {
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`Ollama stream: model=${model}`);

    const response = await this.http.post<NodeJS.ReadableStream>(
      '/api/chat',
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          temperature: options.temperature,
          top_p: options.topP,
          num_predict: options.maxTokens,
          stop: options.stop,
        },
      },
      { responseType: 'stream' },
    );

    const stream = response.data;
    let buffer = '';

    for await (const raw of stream as AsyncIterable<Buffer>) {
      buffer += raw.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let chunk: OllamaStreamChunk;
        try {
          chunk = JSON.parse(trimmed) as OllamaStreamChunk;
        } catch {
          continue;
        }

        if (chunk.done) {
          const promptTokens = chunk.prompt_eval_count ?? 0;
          const completionTokens = chunk.eval_count ?? 0;
          yield {
            delta: '',
            done: true,
            model: chunk.model,
            provider: this.providerId,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          };
          return;
        }

        yield {
          delta: chunk.message.content,
          done: false,
          provider: this.providerId,
        };
      }
    }
  }

  async embed(
    text: string,
    options: LlmEmbeddingOptions = {},
  ): Promise<LlmEmbeddingResult> {
    const model = options.model ?? this.defaultModel;

    this.logger.debug(`Ollama embed: model=${model}`);

    const response = await this.http.post<OllamaEmbedResponse>('/api/embed', {
      model,
      input: text,
    });

    const data = response.data;
    const promptTokens = data.prompt_eval_count ?? 0;

    return {
      embedding: data.embeddings[0] ?? [],
      model: data.model,
      provider: this.providerId,
      usage: {
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
      },
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    try {
      await this.http.get('/api/tags');
      return {
        provider: this.providerId,
        healthy: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Ollama health check failed: ${error}`);
      return {
        provider: this.providerId,
        healthy: false,
        error,
        checkedAt: new Date(),
      };
    }
  }
}
