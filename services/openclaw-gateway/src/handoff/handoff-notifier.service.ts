import { Injectable, Logger } from '@nestjs/common';

/** Confidence below this threshold triggers an automatic handoff */
const LOW_CONFIDENCE_THRESHOLD = 0.4;

/** Patterns that indicate a user explicitly wants a human agent */
const EXPLICIT_ESCALATION_PATTERNS = [
  /\btalk to (a |an )?(human|person|agent|support|representative|rep)\b/i,
  /\bspeak (with|to) (a |an )?(human|person|agent|support)\b/i,
  /\bconnect me (to|with) (a |an )?(human|person|agent|support)\b/i,
  /\bhuman support\b/i,
  /\blive (agent|chat|support|help)\b/i,
  /\bescalate\b/i,
  /\bneed (a |an )?(human|person|real person)\b/i,
  /\bnot (helpful|useful|working|what i (need|want))\b/i,
];

export interface HandoffResult {
  id: string;
  trigger: string;
  status: string;
  slaDeadline: string;
  contextSummary: string | null;
}

/**
 * HandoffNotifierService
 *
 * Detects when an AI response should be escalated to a human agent and
 * creates a handoff record via the API Gateway's /api/v1/handoffs endpoint.
 *
 * Detection criteria:
 *  1. AI classification confidence below LOW_CONFIDENCE_THRESHOLD
 *  2. User message contains explicit escalation language
 */
@Injectable()
export class HandoffNotifierService {
  private readonly logger = new Logger(HandoffNotifierService.name);
  private readonly apiGatewayUrl: string;

  constructor() {
    this.apiGatewayUrl = process.env.API_GATEWAY_INTERNAL_URL ?? 'http://api-gateway:4000';
  }

  /**
   * Determine if a handoff should be triggered based on confidence and user text.
   * Returns the trigger type or null if no handoff is needed.
   */
  detectTrigger(userText: string, confidence: number): 'low_confidence' | 'explicit_request' | null {
    if (EXPLICIT_ESCALATION_PATTERNS.some((re) => re.test(userText))) {
      return 'explicit_request';
    }
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      return 'low_confidence';
    }
    return null;
  }

  /**
   * Create a handoff via the API Gateway.
   * Returns the created handoff or null on failure (fire-and-forget safe).
   */
  async createHandoff(opts: {
    channel: string;
    userId: string;
    trigger: 'low_confidence' | 'explicit_request';
    confidence: number;
    contextSummary: string;
  }): Promise<HandoffResult | null> {
    try {
      const response = await fetch(`${this.apiGatewayUrl}/api/v1/handoffs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service': process.env.INTERNAL_SERVICE_SECRET ?? '',
        },
        body: JSON.stringify({
          channel: opts.channel,
          userId: opts.userId,
          trigger: opts.trigger,
          confidence: opts.confidence,
          contextSummary: opts.contextSummary,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Handoff creation failed: HTTP ${response.status} for channel=${opts.channel}`,
        );
        return null;
      }

      const handoff = (await response.json()) as HandoffResult;
      this.logger.log(
        `Handoff created: ${handoff.id} (trigger=${opts.trigger}, channel=${opts.channel})`,
      );
      return handoff;
    } catch (err) {
      this.logger.error(`Failed to create handoff: ${String(err)}`);
      return null;
    }
  }

  /**
   * Build a short context summary from recent conversation history.
   * Returns a plain-text summary of the last few turns.
   */
  buildContextSummary(
    userText: string,
    agentResponse: string,
    intent: string,
    confidence: number,
  ): string {
    const parts: string[] = [
      `User: "${userText.slice(0, 200)}"`,
      `AI (${intent}, confidence=${(confidence * 100).toFixed(0)}%): "${agentResponse.slice(0, 200)}"`,
    ];
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      parts.push(`Note: AI confidence was low (${(confidence * 100).toFixed(0)}%), escalating to human.`);
    }
    return parts.join('\n');
  }
}
