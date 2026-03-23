import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IntentClassifierService } from './intent-classifier.service';
import { DelegationService } from './delegation.service';
import { MentionParserService } from './mention-parser.service';
import { CommsAgent } from '../agents/comms/comms.agent';
import { FinanceAgent } from '../agents/finance/finance.agent';
import { GrowthAgent } from '../agents/growth/growth.agent';
import { OpsAgent } from '../agents/ops/ops.agent';
import { ResearchAgent } from '../agents/research/research.agent';
import { ErpAgent } from '../agents/erp/erp.agent';
import { BuilderAgent } from '../agents/builder/builder.agent';
import { SentinelAgent } from '../agents/sentinel/sentinel.agent';
import type {
  AgentContext,
  AgentMessage,
  AgentResponse,
  AgentType,
} from '../interfaces/agent-base.interface';
import type { ClassificationResult, RoutingDecision } from '../interfaces/classification.interface';

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
 * 2. Checks for @mention syntax (UNC-1028) — if found, routes directly to
 *    the mentioned specialist, bypassing LLM classification.
 * 3. Otherwise classifies the user's intent using {@link IntentClassifierService}.
 * 4. Delegates to the appropriate specialist via {@link DelegationService}.
 * 5. Returns both the specialist response and full routing metadata.
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
    private readonly mentionParser: MentionParserService,
    // Specialist agents injected by NestJS DI
    private readonly commsAgent: CommsAgent,
    private readonly financeAgent: FinanceAgent,
    private readonly growthAgent: GrowthAgent,
    private readonly opsAgent: OpsAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly erpAgent: ErpAgent,
    private readonly builderAgent: BuilderAgent,
    private readonly sentinelAgent: SentinelAgent,
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
      this.sentinelAgent,
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
   * Process a raw user message through the classify → delegate pipeline.
   *
   * When the message contains an @mention (e.g. `@finance show Q3 burn rate`),
   * classification is skipped and the message is routed directly to the
   * mentioned specialist.  This enables mid-conversation hand-offs without
   * an LLM round-trip (UNC-1028).
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

    // --- @mention detection (UNC-1028) -----------------------------------
    const { mention, strippedContent } = this.mentionParser.parse(rawContent.trim());
    if (mention) {
      return this.processMention(
        mention,
        strippedContent || rawContent.trim(),
        rawContent.trim(),
        sessionId,
        from,
        context,
        startedAt,
      );
    }

    // --- normal LLM-classification path ----------------------------------
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

  /**
   * Route an @mention directly to the target specialist, bypassing classification.
   */
  private async processMention(
    mention: AgentType,
    strippedContent: string,
    rawContent: string,
    sessionId: string,
    from: string,
    context: Partial<AgentContext> | undefined,
    startedAt: number,
  ): Promise<RouterProcessResult> {
    this.logger.log(
      `@mention detected: routing directly to '${mention}' (session=${sessionId})`,
    );

    const message = this.buildMessage(strippedContent, sessionId, from);
    message.metadata = { ...message.metadata, mentionRaw: rawContent };
    const agentContext = this.buildContext(sessionId, context);

    // Synthetic classification — 100 % confidence for explicit @mention
    const classification: ClassificationResult = {
      intent: mention,
      confidence: 1.0,
      reasoning: `Direct @mention routing to ${mention}`,
      alternates: [],
    };

    try {
      const { response, decision } = await this.delegation.delegate(
        message,
        classification,
        agentContext,
      );

      const processingTimeMs = Date.now() - startedAt;

      this.logger.log(
        `@mention message processed in ${processingTimeMs}ms → ${decision.targetAgent}`,
      );

      return {
        response,
        decision: { ...decision, mentionRouted: true },
        processingTimeMs,
      };
    } catch (error) {
      this.logger.error(
        `Error processing @mention message ${message.id}: ${String(error)}`,
      );
      return this.buildErrorResult(message.id, startedAt, error);
    }
  }

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
