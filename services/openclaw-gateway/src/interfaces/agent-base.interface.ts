/**
 * Core interfaces for all OpenClaw agents.
 * All specialist agents must implement ISpecialistAgent.
 * The Router Agent implements IRouterAgent.
 */

export type AgentType =
  | 'comms'
  | 'finance'
  | 'growth'
  | 'ops'
  | 'research'
  | 'erp'
  | 'builder';

export type IntentCategory =
  | 'comms'
  | 'finance'
  | 'growth'
  | 'ops'
  | 'research'
  | 'erp'
  | 'builder'
  | 'unknown';

export interface AgentMessage {
  /** Unique message identifier */
  id: string;
  /** Sender identity (user ID or agent type) */
  from: string;
  /** Recipient agent type or 'router' */
  to: string;
  /** Natural language content */
  content: string;
  /** Conversation session identifier */
  sessionId: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Arbitrary metadata passed through the pipeline */
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  /** Message this is responding to */
  requestId: string;
  /** Responding agent type */
  agentType: string;
  /** Natural language response content */
  content: string;
  /** Whether this is a complete or partial (streaming) response */
  done: boolean;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Any structured data returned alongside the text */
  data?: Record<string, unknown>;
  /** Error information when done === true and processing failed */
  error?: AgentError;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface AgentContext {
  /** Conversation session ID */
  sessionId: string;
  /** Short-term conversation history (last N turns) */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Business metadata injected from unicore.config.json */
  businessContext?: Record<string, unknown>;
}

/**
 * Base interface every specialist agent must implement.
 */
export interface ISpecialistAgent {
  /** Unique agent type identifier */
  readonly agentType: AgentType;

  /**
   * Process a message delegated by the Router Agent.
   * @param message   The original user message with routing metadata.
   * @param context   Conversation context (history, business data).
   * @returns         Resolved agent response promise.
   */
  handle(message: AgentMessage, context: AgentContext): Promise<AgentResponse>;

  /**
   * Return whether this agent is currently available to handle requests.
   * Agents may be unavailable during startup, maintenance, or throttle windows.
   */
  isAvailable(): boolean;
}
