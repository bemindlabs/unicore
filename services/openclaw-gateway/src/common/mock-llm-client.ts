import { Injectable, Logger } from '@nestjs/common';
import type { ILlmClient, LlmCompletionOptions, LlmCompletionResult, LlmMessage } from './llm-client.interface';
import type { IntentCategory } from '../interfaces/agent-base.interface';

/**
 * Mock LLM client used for local development and testing.
 *
 * It performs simple keyword matching to simulate intent classification
 * without requiring a live API key.  Replace with a real adapter
 * (OpenAI, Anthropic, Ollama, etc.) in production.
 */
@Injectable()
export class MockLlmClient implements ILlmClient {
  private readonly logger = new Logger(MockLlmClient.name);

  private readonly KEYWORD_MAP: Array<{ keywords: string[]; intent: IntentCategory }> = [
    { keywords: ['email', 'reply', 'message', 'inbox', 'outreach', 'send', 'chat', 'dm', 'slack'], intent: 'comms' },
    { keywords: ['invoice', 'payment', 'expense', 'cash', 'finance', 'budget', 'transaction', 'revenue', 'cost'], intent: 'finance' },
    { keywords: ['funnel', 'ad', 'campaign', 'conversion', 'seo', 'growth', 'traffic', 'leads', 'marketing'], intent: 'growth' },
    { keywords: ['task', 'schedule', 'project', 'deadline', 'calendar', 'ops', 'assign', 'status'], intent: 'ops' },
    { keywords: ['research', 'competitor', 'market', 'trend', 'intel', 'news', 'analyze', 'survey'], intent: 'research' },
    { keywords: ['order', 'inventory', 'stock', 'contact', 'customer', 'crm', 'erp', 'product', 'fulfillment'], intent: 'erp' },
    { keywords: ['code', 'deploy', 'build', 'api', 'bug', 'script', 'infra', 'server', 'developer'], intent: 'builder' },
  ];

  async complete(
    messages: LlmMessage[],
    _options?: LlmCompletionOptions,
  ): Promise<LlmCompletionResult> {
    const userMsg = messages.find((m) => m.role === 'user');
    const text = (userMsg?.content ?? '').toLowerCase();

    let bestIntent: IntentCategory = 'unknown';
    let bestScore = 0;
    const scores: Array<{ intent: IntentCategory; score: number }> = [];

    for (const { keywords, intent } of this.KEYWORD_MAP) {
      const hits = keywords.filter((kw) => text.includes(kw)).length;
      const score = hits / keywords.length;
      scores.push({ intent, score });
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    const confidence = bestScore > 0 ? Math.min(0.5 + bestScore * 2, 0.95) : 0.1;

    const alternates = scores
      .filter((s) => s.intent !== bestIntent && s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((s) => ({
        intent: s.intent,
        confidence: Math.min(0.4 + s.score * 1.5, 0.7),
      }));

    const result = {
      intent: bestIntent,
      confidence,
      reasoning: `Matched keywords associated with the '${bestIntent}' domain.`,
      alternates,
    };

    this.logger.debug(`MockLlmClient classified: ${JSON.stringify(result)}`);

    return {
      content: JSON.stringify(result),
      model: 'mock-llm-v1',
      totalTokens: text.split(' ').length + 50,
    };
  }
}
