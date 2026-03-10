import { Injectable, Inject, Logger } from '@nestjs/common';
import { LLM_CLIENT, type ILlmClient } from '../common/llm-client.interface';
import {
  buildClassificationSystemPrompt,
  buildClassificationUserPrompt,
} from '../prompts/router.prompts';
import type { ClassificationResult } from '../interfaces/classification.interface';
import type { IntentCategory } from '../interfaces/agent-base.interface';

/** Minimum confidence threshold below which we treat result as 'unknown'. */
const CONFIDENCE_THRESHOLD = 0.35;

/** Valid set of intent categories for response validation. */
const VALID_INTENTS = new Set<string>([
  'comms',
  'finance',
  'growth',
  'ops',
  'research',
  'erp',
  'builder',
  'unknown',
]);

/**
 * IntentClassifierService
 *
 * Sends the user message to an LLM using the Router Agent system prompt and
 * parses the structured JSON classification response.
 *
 * Injected LLM client is provided via DI token {@link LLM_CLIENT} so it can
 * be swapped between real providers (OpenAI, Anthropic, Ollama) and the mock
 * used in development/tests.
 */
@Injectable()
export class IntentClassifierService {
  private readonly logger = new Logger(IntentClassifierService.name);
  private readonly systemPrompt = buildClassificationSystemPrompt();

  constructor(@Inject(LLM_CLIENT) private readonly llm: ILlmClient) {}

  /**
   * Classify the intent of a raw user message.
   *
   * @param userMessage  The verbatim user message.
   * @returns            Parsed {@link ClassificationResult}.
   */
  async classify(userMessage: string): Promise<ClassificationResult> {
    this.logger.debug(`Classifying message (${userMessage.length} chars)`);

    try {
      const result = await this.llm.complete(
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: buildClassificationUserPrompt(userMessage) },
        ],
        { temperature: 0.1, maxTokens: 256 },
      );

      return this.parseClassificationResponse(result.content);
    } catch (error) {
      this.logger.error(`LLM call failed during classification: ${String(error)}`);
      return this.unknownResult('LLM_ERROR');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private parseClassificationResponse(raw: string): ClassificationResult {
    let parsed: Record<string, unknown>;

    try {
      // Strip optional markdown code fences the model may add despite instructions
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      this.logger.warn(`Failed to parse LLM response as JSON: ${raw.slice(0, 200)}`);
      return this.unknownResult('PARSE_ERROR');
    }

    const intent = parsed['intent'] as string | undefined;
    const confidence = parsed['confidence'] as number | undefined;
    const reasoning = parsed['reasoning'] as string | undefined;
    const rawAlternates = parsed['alternates'];

    if (!intent || !VALID_INTENTS.has(intent)) {
      this.logger.warn(`Invalid intent in LLM response: ${String(intent)}`);
      return this.unknownResult('INVALID_INTENT');
    }

    const safeConfidence =
      typeof confidence === 'number' && confidence >= 0 && confidence <= 1
        ? confidence
        : 0.5;

    // If confidence is below threshold, downgrade to unknown
    const resolvedIntent: IntentCategory =
      safeConfidence >= CONFIDENCE_THRESHOLD
        ? (intent as IntentCategory)
        : 'unknown';

    const alternates = this.parseAlternates(rawAlternates);

    return {
      intent: resolvedIntent,
      confidence: safeConfidence,
      reasoning: typeof reasoning === 'string' ? reasoning : `Classified as ${resolvedIntent}`,
      alternates,
    };
  }

  private parseAlternates(
    raw: unknown,
  ): ClassificationResult['alternates'] {
    if (!Array.isArray(raw)) return [];

    return (raw as unknown[])
      .filter(
        (item): item is { intent: string; confidence: number } =>
          typeof item === 'object' &&
          item !== null &&
          'intent' in item &&
          'confidence' in item &&
          VALID_INTENTS.has((item as Record<string, unknown>)['intent'] as string),
      )
      .map((item) => ({
        intent: item.intent as IntentCategory,
        confidence: Number(item.confidence),
      }));
  }

  private unknownResult(reason: string): ClassificationResult {
    this.logger.debug(`Returning unknown classification (reason: ${reason})`);
    return {
      intent: 'unknown',
      confidence: 0,
      reasoning: `Classification unavailable: ${reason}`,
      alternates: [],
    };
  }
}
