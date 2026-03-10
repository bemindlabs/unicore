import { Injectable, Logger } from '@nestjs/common';
import type {
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentType,
  ISpecialistAgent,
} from '../interfaces/agent-base.interface';
import type { ClassificationResult, RoutingDecision } from '../interfaces/classification.interface';
import { FALLBACK_RESPONSE_TEMPLATE } from '../prompts/router.prompts';

/**
 * DelegationService
 *
 * Translates an intent classification result into an actual specialist agent
 * invocation.  The map of available agents is injected at module construction
 * time — this avoids any circular dependency with the registry and keeps
 * routing logic decoupled from provider registration.
 *
 * Responsibilities:
 * 1. Map the classified intent to an available specialist agent.
 * 2. Fall back gracefully when the target agent is unavailable or unknown.
 * 3. Produce a {@link RoutingDecision} record for observability / audit.
 */
@Injectable()
export class DelegationService {
  private readonly logger = new Logger(DelegationService.name);

  /** agentType -> specialist agent instance */
  private readonly agents = new Map<AgentType, ISpecialistAgent>();

  /**
   * Register a specialist agent.  Called by RouterModule during wiring.
   * Registering twice with the same type overwrites the prior registration.
   */
  registerAgent(agent: ISpecialistAgent): void {
    this.agents.set(agent.agentType, agent);
    this.logger.log(`Specialist agent registered for delegation: ${agent.agentType}`);
  }

  /**
   * Route a classified message to the appropriate specialist agent.
   *
   * @param message        The original user message.
   * @param classification The intent classification result.
   * @param context        Conversation context.
   * @returns              The specialist agent's response plus routing metadata.
   */
  async delegate(
    message: AgentMessage,
    classification: ClassificationResult,
    context: AgentContext,
  ): Promise<{ response: AgentResponse; decision: RoutingDecision }> {
    const targetType =
      classification.intent === 'unknown' ? null : (classification.intent as AgentType);

    const { agent, isFallback, resolvedType } = this.resolveAgent(targetType);

    const decision: RoutingDecision = {
      messageId: message.id,
      classification,
      targetAgent: resolvedType,
      isFallback,
      decidedAt: new Date().toISOString(),
    };

    this.logger.log(
      `Routing message ${message.id} → ${resolvedType} ` +
        `(intent=${classification.intent}, confidence=${classification.confidence.toFixed(2)}, fallback=${isFallback})`,
    );

    if (!agent) {
      const response = this.buildFallbackResponse(message.id);
      return { response, decision };
    }

    const response = await agent.handle(message, context);
    return { response, decision };
  }

  /**
   * Return all registered agent types (useful for health checks and tests).
   */
  registeredTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private resolveAgent(targetType: AgentType | null): {
    agent: ISpecialistAgent | undefined;
    isFallback: boolean;
    resolvedType: string;
  } {
    if (targetType) {
      const agent = this.agents.get(targetType);
      if (agent && agent.isAvailable()) {
        return { agent, isFallback: false, resolvedType: targetType };
      }

      this.logger.warn(
        `Agent '${targetType}' is ${agent ? 'unavailable' : 'not registered'} — using fallback`,
      );
    }

    return { agent: undefined, isFallback: true, resolvedType: 'fallback' };
  }

  private buildFallbackResponse(requestId: string): AgentResponse {
    return {
      requestId,
      agentType: 'router',
      content: FALLBACK_RESPONSE_TEMPLATE,
      done: true,
      timestamp: new Date().toISOString(),
      data: { fallback: true },
    };
  }
}
