import type { IntentCategory } from './agent-base.interface';

/**
 * Result returned by the LLM intent classification step.
 */
export interface ClassificationResult {
  /** Classified intent domain */
  intent: IntentCategory;
  /**
   * Confidence score 0–1 as reported by the model.
   * May be absent when the underlying provider does not supply logprobs.
   */
  confidence: number;
  /** Human-readable explanation from the model */
  reasoning: string;
  /**
   * Alternate intents considered, in descending confidence order.
   * Useful for ambiguous messages that touch multiple domains.
   */
  alternates?: Array<{ intent: IntentCategory; confidence: number }>;
}

/**
 * Routing decision produced by the Router Agent after classification.
 */
export interface RoutingDecision {
  /** Original message identifier */
  messageId: string;
  /** Classification result */
  classification: ClassificationResult;
  /** Resolved target agent type (may differ from intent if agent unavailable) */
  targetAgent: string;
  /** Whether this was a fallback decision */
  isFallback: boolean;
  /** ISO-8601 timestamp of the routing decision */
  decidedAt: string;
}
