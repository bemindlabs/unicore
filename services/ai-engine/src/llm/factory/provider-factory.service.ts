import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { OpenAiProvider } from '../providers/openai.provider';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { OllamaProvider } from '../providers/ollama.provider';

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly attemptedProviders: string[],
    public readonly underlyingErrors: string[],
  ) {
    super(
      `All LLM providers failed. Attempted: [${attemptedProviders.join(', ')}]. ` +
        `Errors: ${underlyingErrors.join(' | ')}`,
    );
    this.name = 'ProviderUnavailableError';
  }
}

@Injectable()
export class ProviderFactoryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderFactoryService.name);
  private readonly registry = new Map<string, ILlmProvider>();
  private primaryProviderId: string;
  private failoverProviderIds: string[];
  private failoverEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.primaryProviderId = this.config.get<string>(
      'LLM_PRIMARY_PROVIDER',
      'openai',
    );
    this.failoverProviderIds = (
      this.config.get<string>('LLM_FAILOVER_PROVIDERS', 'anthropic,ollama')
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.failoverEnabled =
      this.config.get<string>('LLM_FAILOVER_ENABLED', 'true') === 'true';
  }

  onModuleInit(): void {
    this.initProviders();
    this.logger.log(
      `Provider factory initialised. Primary: ${this.primaryProviderId}. ` +
        `Failover: [${this.failoverProviderIds.join(', ')}]. Failover enabled: ${this.failoverEnabled}`,
    );
  }

  private initProviders(): void {
    const openAiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openAiKey) {
      this.registry.set(
        'openai',
        new OpenAiProvider(
          openAiKey,
          this.config.get<string>('OPENAI_DEFAULT_MODEL', 'gpt-4o'),
          'text-embedding-3-small',
          this.config.get<string>('OPENAI_BASE_URL'),
        ),
      );
    }

    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.registry.set(
        'anthropic',
        new AnthropicProvider(
          anthropicKey,
          this.config.get<string>(
            'ANTHROPIC_DEFAULT_MODEL',
            'claude-3-5-sonnet-20241022',
          ),
        ),
      );
    }

    // Ollama is always registered — it's local and requires no key
    this.registry.set(
      'ollama',
      new OllamaProvider(
        this.config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434'),
        this.config.get<string>('OLLAMA_DEFAULT_MODEL', 'llama3.2'),
        this.config.get<number>('LLM_REQUEST_TIMEOUT_MS', 120_000),
      ),
    );
  }

  /**
   * Returns the named provider, or throws if it is not registered.
   */
  getProvider(providerId: string): ILlmProvider {
    const provider = this.registry.get(providerId);
    if (!provider) {
      throw new Error(`LLM provider "${providerId}" is not registered.`);
    }
    return provider;
  }

  /**
   * Returns all registered providers.
   */
  getAllProviders(): ILlmProvider[] {
    return [...this.registry.values()];
  }

  /**
   * Ordered provider chain: primary first, then failovers (if enabled).
   */
  private getProviderChain(skipEmbedUnsupported = false): ILlmProvider[] {
    const ids = this.failoverEnabled
      ? [this.primaryProviderId, ...this.failoverProviderIds]
      : [this.primaryProviderId];

    return ids
      .filter((id) => this.registry.has(id))
      .map((id) => this.registry.get(id)!)
      .filter((p) => !skipEmbedUnsupported || p.providerId !== 'anthropic');
  }

  /**
   * Complete with automatic failover across the provider chain.
   */
  async completeWithFailover(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    preferredProvider?: string,
  ): Promise<LlmCompletionResult> {
    const chain = preferredProvider
      ? [
          this.getProvider(preferredProvider),
          ...this.getProviderChain().filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain();

    const attempted: string[] = [];
    const errors: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.providerId);
      try {
        const result = await provider.complete(messages, options);
        if (attempted.length > 1) {
          this.logger.warn(
            `Failover succeeded with provider "${provider.providerId}" after failures: [${attempted.slice(0, -1).join(', ')}]`,
          );
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Provider "${provider.providerId}" failed: ${msg}`,
        );
        errors.push(`${provider.providerId}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Stream with failover — falls back to non-streaming complete on failover providers.
   */
  async *streamWithFailover(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    preferredProvider?: string,
  ): AsyncGenerator<LlmStreamChunk> {
    const primary = preferredProvider
      ? this.getProvider(preferredProvider)
      : this.getProvider(this.primaryProviderId);

    try {
      yield* primary.stream(messages, options);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Primary provider "${primary.providerId}" stream failed: ${msg}. Falling back to completion.`,
      );
    }

    // Failover: use completeWithFailover and emit as a single done chunk
    const fallbackProviders = this.failoverEnabled
      ? this.failoverProviderIds.filter((id) => id !== primary.providerId)
      : [];

    const attempted: string[] = [primary.providerId];
    const errors: string[] = [];

    for (const id of fallbackProviders) {
      const provider = this.registry.get(id);
      if (!provider) continue;

      attempted.push(id);
      try {
        const result = await provider.complete(messages, options);
        // Emit the full content as a stream of chunks for API compatibility
        const chunkSize = 20;
        for (let i = 0; i < result.content.length; i += chunkSize) {
          yield {
            delta: result.content.slice(i, i + chunkSize),
            done: false,
            provider: result.provider,
          };
        }
        yield {
          delta: '',
          done: true,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
        };
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${id}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Embed with failover, skipping providers that don't support embeddings.
   */
  async embedWithFailover(
    text: string,
    options?: LlmEmbeddingOptions,
    preferredProvider?: string,
  ): Promise<LlmEmbeddingResult> {
    const chain = preferredProvider
      ? [
          this.getProvider(preferredProvider),
          ...this.getProviderChain(true).filter(
            (p) => p.providerId !== preferredProvider,
          ),
        ]
      : this.getProviderChain(true);

    const attempted: string[] = [];
    const errors: string[] = [];

    for (const provider of chain) {
      attempted.push(provider.providerId);
      try {
        return await provider.embed(text, options);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Provider "${provider.providerId}" embed failed: ${msg}`);
        errors.push(`${provider.providerId}: ${msg}`);
      }
    }

    throw new ProviderUnavailableError(attempted, errors);
  }

  /**
   * Run health checks on all registered providers.
   */
  async checkAllHealth(): Promise<ProviderHealthStatus[]> {
    return Promise.all(
      [...this.registry.values()].map((p) => p.healthCheck()),
    );
  }
}
