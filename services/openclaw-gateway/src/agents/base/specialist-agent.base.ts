/**
 * Base abstract class for all OpenClaw specialist agents.
 */
import { Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
  ISpecialistAgent,
  AgentMessage,
  AgentContext,
  AgentResponse,
  AgentError,
  AgentType,
} from "../../interfaces/agent-base.interface";

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
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
    type: "object";
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

export interface SpecialistAgentConfig {
  displayName: string;
  description: string;
  version: string;
}

export abstract class SpecialistAgentBase implements ISpecialistAgent {
  abstract readonly agentType: AgentType;
  abstract readonly config: SpecialistAgentConfig;
  protected readonly logger: Logger;
  private _available = true;

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  protected abstract buildSystemPrompt(context: AgentContext): string;
  abstract getToolDefinitions(): ToolDefinition[];
  protected abstract executeTool(
    call: ToolCall,
    context: AgentContext,
  ): Promise<ToolResult>;

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

  setAvailable(available: boolean): void {
    this._available = available;
    this.logger.log(`[${this.agentType}] availability set to: ${available}`);
  }

  protected async executeInternal(
    message: AgentMessage,
    context: AgentContext,
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(context);
    const tools = this.getToolDefinitions();
    this.logger.debug(
      `[${this.agentType}] system prompt length=${systemPrompt.length}, tools=${tools.map((t) => t.name).join(", ")}`,
    );

    const content = await this.callLlm(systemPrompt, message.content);

    return {
      requestId: message.id,
      agentType: this.agentType,
      content,
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

  protected async callLlm(
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const aiEngineUrl = process.env["AI_ENGINE_URL"];
    if (!aiEngineUrl) {
      this.logger.warn(
        `[${this.agentType}] AI_ENGINE_URL not configured — returning fallback response`,
      );
      return `⚠️ AI Engine not configured. Please set your API key in Settings → AI Configuration.`;
    }

    try {
      const response = await fetch(`${aiEngineUrl}/api/v1/llm/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          maxTokens: 1024,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: response.statusText })) as { message?: string; errors?: string[] };
        const detail = err.errors?.join('; ') || err.message || response.statusText;
        this.logger.error(`[${this.agentType}] LLM request failed: ${response.status} ${detail}`);

        if (response.status === 503) {
          return `⚠️ All AI providers are currently unavailable. Please check your API keys in Settings → AI Configuration.\n\nDetails: ${detail}`;
        }
        return `⚠️ AI request failed (${response.status}): ${detail}`;
      }

      const result = (await response.json()) as { content: string };
      return result.content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${this.agentType}] LLM call error: ${msg}`);
      return `⚠️ Could not reach AI Engine: ${msg}`;
    }
  }

  protected buildErrorResponse(requestId: string, error: Error): AgentResponse {
    const agentError: AgentError = {
      code: "AGENT_EXECUTION_ERROR",
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

  protected newId(): string {
    return uuidv4();
  }
}
