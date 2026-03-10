/**
 * Base abstract class for all OpenClaw specialist agents.
 * Provides common infrastructure: tool registry, system prompt management,
 * lifecycle state, and structured execute() scaffolding.
 */

import { Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ISpecialistAgent,
  AgentMessage,
  AgentContext,
  AgentResponse,
  AgentError,
  AgentType,
} from '../../interfaces/agent-base.interface';

// ---------------------------------------------------------------------------
// Tool definition types (OpenAI-compatible function-calling schema)
// ---------------------------------------------------------------------------

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Agent capability metadata
// ---------------------------------------------------------------------------

export interface SpecialistAgentConfig {
  /** Human-readable display name */
  displayName: string;
  /** Short capability description shown in the UI */
  description: string;
  /** Version of this agent implementation */
  version: string;
}

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class SpecialistAgentBase implements ISpecialistAgent {
  abstract readonly agentType: AgentType;
  abstract readonly config: SpecialistAgentConfig;

  protected readonly logger: Logger;
  private _available = true;

  constructor() {
    // Logger name is set after construction when agentType is known.
    this.logger = new Logger(this.constructor.name);
  }

  // -------------------------------------------------------------------------
  // Abstract methods — each specialist must implement
  // -------------------------------------------------------------------------

  /**
   * Return the system prompt injected at the start of every LLM call.
   * May incorporate businessContext from AgentContext.
   */
  protected abstract buildSystemPrompt(context: AgentContext): string;

  /**
   * Tool definitions exposed by this agent for function-calling.
   */
  abstract getToolDefinitions(): ToolDefinition[];

  /**
   * Dispatch a single tool call and return its result.
   * @param call  Tool name + arguments derived from LLM response.
   * @param context  Conversation context.
   */
  protected abstract executeTool(
    call: ToolCall,
    context: AgentContext,
  ): Promise<ToolResult>;

  // -------------------------------------------------------------------------
  // ISpecialistAgent implementation
  // -------------------------------------------------------------------------

  /**
   * Primary entry point. Validates inputs, delegates to executeInternal,
   * wraps any uncaught errors into a structured AgentResponse.
   */
  async handle(
    message: AgentMessage,
    context: AgentContext,
  ): Promise<AgentResponse> {
    this.logger.log(
      `[${this.agentType}] handling message ${message.id} (session=${context.sessionId})`,
    );

    const startedAt = Date.now();

    try {
      const result = await this.executeInternal(message, context);
      this.logger.debug(
        `[${this.agentType}] completed in ${Date.now() - startedAt}ms`,
      );
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `[${this.agentType}] unhandled error: ${error.message}`,
        error.stack,
      );
      return this.buildErrorResponse(message.id, error);
    }
  }

  isAvailable(): boolean {
    return this._available;
  }

  /** Allow gateway to mark an agent as unavailable (e.g. rate-limit window). */
  setAvailable(available: boolean): void {
    this._available = available;
    this.logger.log(
      `[${this.agentType}] availability set to: ${available}`,
    );
  }

  // -------------------------------------------------------------------------
  // Internal execution — override in tests or subclasses for full LLM wiring
  // -------------------------------------------------------------------------

  /**
   * Core execution logic. Subclasses may override this entirely for
   * custom agentic loops. The base implementation provides a structured
   * stub that emits a well-formed AgentResponse with tool definitions
   * embedded in the data payload.
   */
  protected async executeInternal(
    message: AgentMessage,
    context: AgentContext,
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(context);
    const tools = this.getToolDefinitions();

    // Stub: log what would be sent to the LLM
    this.logger.debug(
      `[${this.agentType}] system prompt length=${systemPrompt.length}, tools=${tools.map((t) => t.name).join(', ')}`,
    );

    return {
      requestId: message.id,
      agentType: this.agentType,
      content: this.buildStubResponse(message.content),
      done: true,
      timestamp: new Date().toISOString(),
      data: {
        agentType: this.agentType,
        displayName: this.config.displayName,
        availableTools: tools.map((t) => ({
          name: t.name,
          description: t.description,
        })),
        sessionId: context.sessionId,
        historyLength: context.history.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  protected buildStubResponse(userContent: string): string {
    return (
      `[${this.config.displayName}] received: "${userContent}". ` +
      `This is a stub response — LLM integration is pending.`
    );
  }

  protected buildErrorResponse(
    requestId: string,
    error: Error,
  ): AgentResponse {
    const agentError: AgentError = {
      code: 'AGENT_EXECUTION_ERROR',
      message: error.message,
      retryable: false,
    };
    return {
      requestId,
      agentType: this.agentType,
      content: `An error occurred in the ${this.config.displayName}.`,
      done: true,
      timestamp: new Date().toISOString(),
      error: agentError,
    };
  }

  /** Convenience: generate a correlation-safe ID */
  protected newId(): string {
    return uuidv4();
  }
}
