/**
 * Stub specialist agents — lightweight placeholders for each agent type.
 *
 * These stubs are registered by RouterAgent on startup so the routing pipeline
 * is end-to-end functional before each full specialist agent story is done.
 * Replace or extend each stub as the corresponding Jira story is implemented.
 */

import { AgentContext, AgentMessage, AgentResponse, AgentType } from '../interfaces/agent-base.interface';
import { SpecialistAgentBase, SpecialistAgentConfig, ToolDefinition, ToolCall, ToolResult } from './base/specialist-agent.base';

abstract class StubAgent extends SpecialistAgentBase {
  getToolDefinitions(): ToolDefinition[] {
    return [];
  }

  protected buildSystemPrompt(_context: AgentContext): string {
    return `You are the ${this.config.displayName}. This is a stub implementation.`;
  }

  protected async executeTool(
    _call: ToolCall,
    _context: AgentContext,
  ): Promise<ToolResult> {
    return { toolName: _call.toolName, result: null, error: 'Stub — not implemented' };
  }

  async handle(message: AgentMessage, _context: AgentContext): Promise<AgentResponse> {
    return {
      requestId: message.id,
      agentType: this.agentType,
      content: `[${this.config.displayName} stub] received: "${message.content}". Full implementation pending.`,
      done: true,
      timestamp: new Date().toISOString(),
    };
  }
}

export class CommsStubAgent extends StubAgent {
  readonly agentType: AgentType = 'comms';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Comms Agent',
    description: 'Email drafting and social media management (stub)',
    version: '0.0.1',
  };
}

export class FinanceStubAgent extends StubAgent {
  readonly agentType: AgentType = 'finance';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Finance Agent',
    description: 'Financial operations and reporting (stub)',
    version: '0.0.1',
  };
}

export class GrowthStubAgent extends StubAgent {
  readonly agentType: AgentType = 'growth';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Growth Agent',
    description: 'Marketing analytics and growth tracking (stub)',
    version: '0.0.1',
  };
}

export class OpsStubAgent extends StubAgent {
  readonly agentType: AgentType = 'ops';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Ops Agent',
    description: 'Operations and workflow management (stub)',
    version: '0.0.1',
  };
}

export class ResearchStubAgent extends StubAgent {
  readonly agentType: AgentType = 'research';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Research Agent',
    description: 'Web research and knowledge retrieval (stub)',
    version: '0.0.1',
  };
}

export class ErpStubAgent extends StubAgent {
  readonly agentType: AgentType = 'erp';
  readonly config: SpecialistAgentConfig = {
    displayName: 'ERP Agent',
    description: 'Enterprise resource planning operations (stub)',
    version: '0.0.1',
  };
}

export class BuilderStubAgent extends StubAgent {
  readonly agentType: AgentType = 'builder';
  readonly config: SpecialistAgentConfig = {
    displayName: 'Builder Agent',
    description: 'Content and template generation (stub)',
    version: '0.0.1',
  };
}
