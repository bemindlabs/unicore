import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IntentClassifierService } from './intent-classifier.service';
import { DelegationService } from './delegation.service';
import { CommsAgent } from '../agents/comms/comms.agent';
import { FinanceAgent } from '../agents/finance/finance.agent';
import { GrowthAgent } from '../agents/growth/growth.agent';
import { OpsAgent } from '../agents/ops/ops.agent';
import { ResearchAgent } from '../agents/research/research.agent';
import { ErpAgent } from '../agents/erp/erp.agent';
import { BuilderAgent } from '../agents/builder/builder.agent';
import type {
  AgentContext,
  AgentMessage,
  AgentResponse,
} from '../interfaces/agent-base.interface';
import type { RoutingDecision } from '../interfaces/classification.interface';

export interface RouterProcessResult {
  response: AgentResponse;
  decision: RoutingDecision;
  processingTimeMs: number;
}

/**
 * RouterAgent
 *
 * The always-on orchestration agent that sits at the entry point of every
 * user interaction with the UniCore AI layer.  It:
 *
 * 1. Normalises the raw incoming message into an {@link AgentMessage}.
 * 2. Classifies the user's intent using {@link IntentClassifierService}.
 * 3. Delegates to the appropriate specialist via {@link DelegationService}.
 * 4. Returns both the specialist response and full routing metadata.
 *
 * The Router Agent itself never generates domain-specific content — it only
 * routes and falls back gracefully when classification or delegation fails.
 *
 * NestJS lifecycle: implements `OnModuleInit` to register all specialist
 * agents with the {@link DelegationService} at startup.
 */
@Injectable()
export class RouterAgent implements OnModuleInit {
  private readonly logger = new Logger(RouterAgent.name);

  constructor(
    private readonly classifier: IntentClassifierService,
    private readonly delegation: DelegationService,
    // Specialist agents injected by NestJS DI
    private readonly commsAgent: CommsAgent,
    private readonly financeAgent: FinanceAgent,
    private readonly growthAgent: GrowthAgent,
    private readonly opsAgent: OpsAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly erpAgent: ErpAgent,
    private readonly builderAgent: BuilderAgent,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onModuleInit(): void {
    // Register all specialist agents for delegation
    const specialists = [
      this.commsAgent,
      this.financeAgent,
      this.growthAgent,
      this.opsAgent,
      this.researchAgent,
      this.erpAgent,
      this.builderAgent,
    ];

    for (const agent of specialists) {
      this.delegation.registerAgent(agent);
    }

    this.logger.log(
      `RouterAgent initialised. Specialists available: [${this.delegation.registeredTypes().join(', ')}]`,
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Process a raw user message through the full classify → delegate pipeline.
   *
   * @param rawContent  The verbatim user message text.
   * @param sessionId   Unique conversation/session identifier.
   * @param from        Sender identity (user ID, channel user ID, etc.).
   * @param context     Optional partial conversation context.
   * @returns           Full processing result including response and routing audit.
   */
  async process(
    rawContent: string,
    sessionId: string,
    from: string,
    context?: Partial<AgentContext>,
  ): Promise<RouterProcessResult> {
    const startedAt = Date.now();

    const message = this.buildMessage(rawContent, sessionId, from);
    const agentContext = this.buildContext(sessionId, context);

    this.logger.log(
      `Processing message ${message.id} from '${from}' (session=${sessionId})`,
    );

    try {
      const classification = await this.classifier.classify(rawContent);

      this.logger.debug(
        `Classification: intent=${classification.intent}, confidence=${classification.confidence.toFixed(2)}`,
      );

      const { response, decision } = await this.delegation.delegate(
        message,
        classification,
        agentContext,
      );

      const processingTimeMs = Date.now() - startedAt;

      this.logger.log(
        `Message ${message.id} processed in ${processingTimeMs}ms → ${decision.targetAgent}`,
      );

      return { response, decision, processingTimeMs };
    } catch (error) {
      this.logger.error(
        `Unhandled error processing message ${message.id}: ${String(error)}`,
      );
      return this.buildErrorResult(message.id, startedAt, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildMessage(
    content: string,
    sessionId: string,
    from: string,
  ): AgentMessage {
    return {
      id: uuidv4(),
      from,
      to: 'router',
      content: content.trim(),
      sessionId,
      timestamp: new Date().toISOString(),
    };
  }

  private buildContext(
    sessionId: string,
    partial?: Partial<AgentContext>,
  ): AgentContext {
    return {
      sessionId,
      history: partial?.history ?? [],
      businessContext: partial?.businessContext,
    };
  }

  private buildErrorResult(
    messageId: string,
    startedAt: number,
    error: unknown,
  ): RouterProcessResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal router error';

    const response: AgentResponse = {
      requestId: messageId,
      agentType: 'router',
      content:
        'Sorry, I encountered an unexpected error while processing your request. Please try again.',
      done: true,
      timestamp: new Date().toISOString(),
      error: {
        code: 'ROUTER_ERROR',
        message: errorMessage,
        retryable: true,
      },
    };

    const decision: RoutingDecision = {
      messageId,
      classification: {
        intent: 'unknown',
        confidence: 0,
        reasoning: `Router error: ${errorMessage}`,
        alternates: [],
      },
      targetAgent: 'error',
      isFallback: true,
      decidedAt: new Date().toISOString(),
    };

    return {
      response,
      decision,
      processingTimeMs: Date.now() - startedAt,
    };
  }
}
