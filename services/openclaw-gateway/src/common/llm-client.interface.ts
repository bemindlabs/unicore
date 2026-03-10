/**
 * Minimal LLM provider interface used by the Router Agent.
 * Concrete implementations live in the ai-engine service or can be injected
 * as adapters for OpenAI, Anthropic, local models, etc.
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  /** Max tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0 = deterministic, 1 = creative) */
  temperature?: number;
  /** Model identifier (e.g. "gpt-4o", "claude-3-5-sonnet-20241022") */
  model?: string;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  /** Total tokens consumed (prompt + completion) */
  totalTokens?: number;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface ILlmClient {
  complete(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult>;
}
