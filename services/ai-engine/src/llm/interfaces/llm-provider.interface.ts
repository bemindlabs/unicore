/**
 * Core LLM provider interface defining the contract all providers must implement.
 * Supports completion, streaming, and embedding operations.
 */

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  timeoutMs?: number;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  provider: string;
  usage: LlmUsage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error' | string;
  latencyMs: number;
}

export interface LlmStreamChunk {
  delta: string;
  done: boolean;
  model?: string;
  provider?: string;
  usage?: LlmUsage;
}

export interface LlmEmbeddingOptions {
  model?: string;
  dimensions?: number;
  timeoutMs?: number;
}

export interface LlmEmbeddingResult {
  embedding: number[];
  model: string;
  provider: string;
  usage: LlmUsage;
}

export interface ProviderHealthStatus {
  provider: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: Date;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface ILlmProvider {
  /** Unique provider identifier (e.g. "openai", "anthropic", "ollama") */
  readonly providerId: string;

  /**
   * Generate a completion from a list of messages.
   */
  complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult>;

  /**
   * Stream a completion, yielding chunks as they arrive.
   */
  stream(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): AsyncGenerator<LlmStreamChunk>;

  /**
   * Generate an embedding vector for the given text.
   */
  embed(
    text: string,
    options?: LlmEmbeddingOptions,
  ): Promise<LlmEmbeddingResult>;

  /**
   * Check whether the provider is reachable and responding.
   */
  healthCheck(): Promise<ProviderHealthStatus>;
}
