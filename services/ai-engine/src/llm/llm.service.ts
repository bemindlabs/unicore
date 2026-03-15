import { Injectable } from '@nestjs/common';
import {
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmEmbeddingOptions,
  LlmEmbeddingResult,
  LlmMessage,
  LlmStreamChunk,
  ProviderHealthStatus,
} from './interfaces/llm-provider.interface';
import { ProviderFactoryService } from './factory/provider-factory.service';
import { TokenTrackingService } from '../token-tracking/token-tracking.service';

export interface LlmRequestContext {
  tenantId?: string;
  agentId?: string;
  preferredProvider?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LlmService {
  constructor(
    private readonly factory: ProviderFactoryService,
    private readonly tokenTracking: TokenTrackingService,
  ) {}

  /**
   * Generate a completion for the given messages.
   * Automatically tracks token usage and applies failover.
   */
  async complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    context?: LlmRequestContext,
  ): Promise<LlmCompletionResult> {
    const result = await this.factory.completeWithFailover(
      messages,
      options,
      context?.preferredProvider,
    );

    this.tokenTracking.track({
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      operation: 'complete',
      tenantId: context?.tenantId,
      agentId: context?.agentId,
      latencyMs: result.latencyMs,
      metadata: context?.metadata,
    });

    return result;
  }

  /**
   * Stream a completion, tracking usage from the final done chunk.
   */
  async *stream(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    context?: LlmRequestContext,
  ): AsyncGenerator<LlmStreamChunk> {
    const gen = this.factory.streamWithFailover(
      messages,
      options,
      context?.preferredProvider,
    );

    for await (const chunk of gen) {
      yield chunk;

      if (chunk.done && chunk.usage) {
        this.tokenTracking.track({
          provider: chunk.provider ?? 'unknown',
          model: chunk.model ?? 'unknown',
          usage: chunk.usage,
          operation: 'stream',
          tenantId: context?.tenantId,
          agentId: context?.agentId,
          metadata: context?.metadata,
        });
      }
    }
  }

  /**
   * Generate an embedding vector for the given text.
   */
  async embed(
    text: string,
    options?: LlmEmbeddingOptions,
    context?: LlmRequestContext,
  ): Promise<LlmEmbeddingResult> {
    const result = await this.factory.embedWithFailover(
      text,
      options,
      context?.preferredProvider,
    );

    this.tokenTracking.track({
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      operation: 'embed',
      tenantId: context?.tenantId,
      agentId: context?.agentId,
      metadata: context?.metadata,
    });

    return result;
  }

  /**
   * Check the health of all registered providers.
   */
  async healthCheck(): Promise<ProviderHealthStatus[]> {
    return this.factory.checkAllHealth();
  }
}
