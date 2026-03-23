import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Subject } from 'rxjs';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface MessageSentiment {
  messageId: string;
  sentiment: Sentiment;
  score: number;
}

export interface IntentEntry {
  messageId: string;
  intent: string;
  confidence: number;
}

export interface Entity {
  value: string;
  type: 'email' | 'url' | 'mention' | 'amount' | 'keyword' | 'date';
}

export interface ConversationIntelligence {
  chatHistoryId: string;
  aiSummary: string;
  sentimentOverall: Sentiment;
  messageSentiments: MessageSentiment[];
  intentHistory: IntentEntry[];
  keyEntities: Entity[];
  analyzedAt: string;
}

const POSITIVE_WORDS = new Set([
  'great', 'good', 'excellent', 'perfect', 'thanks', 'thank', 'helpful', 'amazing',
  'wonderful', 'love', 'awesome', 'happy', 'pleased', 'satisfied', 'fantastic',
  'brilliant', 'superb', 'nice', 'glad', 'appreciate', 'correct', 'yes', 'exactly', 'right',
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'wrong', 'error',
  'broken', 'fail', 'failed', 'issue', 'problem', 'bug', 'frustrated', 'angry',
  'disappointed', 'useless', 'cant', 'cannot',
  'impossible', 'never', 'stuck', 'confused', 'unclear', 'missing', 'crash',
]);

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
const MENTION_RE = /@([a-zA-Z0-9_\-]+)/g;
const AMOUNT_RE = /\$\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:USD|EUR|THB|baht|dollars?|euros?)/gi;
const DATE_RE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi;

@Injectable()
export class ConversationIntelligenceService {
  // Per-conversation SSE subjects
  private readonly streams = new Map<string, Subject<ConversationIntelligence>>();

  constructor(private readonly prisma: PrismaService) {}

  private scoreSentiment(text: string): number {
    const lower = text.toLowerCase();
    const tokens = lower.match(/\b\w+\b/g) ?? [];
    let score = 0;
    for (const t of tokens) {
      if (POSITIVE_WORDS.has(t)) score++;
      if (NEGATIVE_WORDS.has(t)) score--;
    }
    // Also check multi-word negative phrases
    if (/not working|doesn't work|can't|cannot|doesn't/.test(lower)) score--;
    return score;
  }

  private classifySentiment(score: number): Sentiment {
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  private detectIntent(text: string): { intent: string; confidence: number } {
    const lower = text.trim().toLowerCase();
    if (/[?？]$/.test(text) || /^(?:what|how|why|when|where|who|which|is|are|does|do|can|could|would|will)\b/.test(lower)) {
      return { intent: 'question', confidence: 0.9 };
    }
    if (/^(?:please|could you|can you|would you|i need|i want|help me|show me|create|make|build|add|remove|delete|update|fix|tell me)/.test(lower)) {
      return { intent: 'request', confidence: 0.85 };
    }
    if (/\b(?:error|bug|broken|not working|issue|problem|crash|fail|wrong|doesn't work)\b/.test(lower)) {
      return { intent: 'complaint', confidence: 0.8 };
    }
    if (/^(?:yes|no|ok|okay|sure|agreed|confirmed|correct|exactly|right|got it|understood|done|thanks)/.test(lower)) {
      return { intent: 'confirmation', confidence: 0.75 };
    }
    if (/\b(?:here is|here's|below is|the result|output|summary|list of|showing)\b/.test(lower)) {
      return { intent: 'information', confidence: 0.7 };
    }
    return { intent: 'statement', confidence: 0.5 };
  }

  private extractEntities(texts: string[]): Entity[] {
    const seen = new Set<string>();
    const entities: Entity[] = [];

    const add = (value: string, type: Entity['type']) => {
      const key = `${type}:${value.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({ value, type });
      }
    };

    for (const text of texts) {
      for (const m of text.matchAll(EMAIL_RE)) add(m[0], 'email');
      for (const m of text.matchAll(URL_RE)) add(m[0], 'url');
      for (const m of text.matchAll(MENTION_RE)) add(m[1], 'mention');
      for (const m of text.matchAll(AMOUNT_RE)) add(m[0].trim(), 'amount');
      for (const m of text.matchAll(DATE_RE)) add(m[0].trim(), 'date');
    }

    return entities.slice(0, 20);
  }

  private generateSummary(messages: Array<{ text: string; authorId: string; authorType?: string }>): string {
    if (messages.length === 0) return 'Empty conversation.';

    const humanMsgs = messages.filter((m) => m.authorId === 'human-user' || m.authorType === 'human' || m.authorId === 'user');
    const agentMsgs = messages.filter((m) => m.authorId !== 'human-user' && m.authorType !== 'human' && m.authorId !== 'user');

    const firstHuman = humanMsgs[0]?.text?.trim() ?? '';
    const lastAgent = agentMsgs[agentMsgs.length - 1]?.text?.trim() ?? '';

    const topic = firstHuman.length > 80 ? firstHuman.slice(0, 77) + '...' : firstHuman;
    const response = lastAgent.length > 100 ? lastAgent.slice(0, 97) + '...' : lastAgent;

    if (topic && response) {
      return `User asked: "${topic}". Agent responded: "${response}"`;
    }
    if (topic) {
      return `User asked: "${topic}". Conversation with ${messages.length} message(s).`;
    }
    return `Conversation with ${messages.length} message(s).`;
  }

  async analyze(chatHistoryId: string): Promise<ConversationIntelligence> {
    const record = await this.prisma.chatHistory.findUnique({ where: { id: chatHistoryId } });
    if (!record) throw new NotFoundException(`Chat history ${chatHistoryId} not found`);

    const messages: Array<{ id: string; text: string; authorId: string; authorType?: string }> =
      Array.isArray(record.messages) ? (record.messages as any[]) : [];

    // Per-message sentiment
    const messageSentiments: MessageSentiment[] = messages.map((m) => {
      const score = this.scoreSentiment(m.text ?? '');
      return { messageId: m.id, sentiment: this.classifySentiment(score), score };
    });

    // Overall sentiment — weighted average
    const totalScore = messageSentiments.reduce((sum, ms) => sum + ms.score, 0);
    const sentimentOverall = this.classifySentiment(messages.length > 0 ? totalScore : 0);

    // Intent history — only human messages
    const intentHistory: IntentEntry[] = messages
      .filter((m) => m.authorId === 'human-user' || m.authorType === 'human' || m.authorId === 'user')
      .map((m) => {
        const { intent, confidence } = this.detectIntent(m.text ?? '');
        return { messageId: m.id, intent, confidence };
      });

    // Key entities
    const keyEntities = this.extractEntities(messages.map((m) => m.text ?? ''));

    // AI summary
    const aiSummary = this.generateSummary(messages);

    const analyzedAt = new Date().toISOString();

    // Persist to DB
    await this.prisma.chatHistory.update({
      where: { id: chatHistoryId },
      data: {
        aiSummary,
        sentimentOverall,
        messageSentiments: messageSentiments as any,
        intentHistory: intentHistory as any,
        keyEntities: keyEntities as any,
        intelligenceAt: new Date(analyzedAt),
      },
    });

    const result: ConversationIntelligence = {
      chatHistoryId,
      aiSummary,
      sentimentOverall,
      messageSentiments,
      intentHistory,
      keyEntities,
      analyzedAt,
    };

    // Notify SSE subscribers
    this.streams.get(chatHistoryId)?.next(result);

    return result;
  }

  async getIntelligence(chatHistoryId: string): Promise<ConversationIntelligence | null> {
    const record = await this.prisma.chatHistory.findUnique({ where: { id: chatHistoryId } });
    if (!record) throw new NotFoundException(`Chat history ${chatHistoryId} not found`);

    if (!record.intelligenceAt) return null;

    return {
      chatHistoryId: record.id,
      aiSummary: record.aiSummary ?? '',
      sentimentOverall: (record.sentimentOverall as Sentiment) ?? 'neutral',
      messageSentiments: (record.messageSentiments as any) ?? [],
      intentHistory: (record.intentHistory as any) ?? [],
      keyEntities: (record.keyEntities as any) ?? [],
      analyzedAt: record.intelligenceAt.toISOString(),
    };
  }

  getOrCreateStream(chatHistoryId: string): Subject<ConversationIntelligence> {
    if (!this.streams.has(chatHistoryId)) {
      this.streams.set(chatHistoryId, new Subject<ConversationIntelligence>());
    }
    return this.streams.get(chatHistoryId)!;
  }

  removeStream(chatHistoryId: string): void {
    this.streams.delete(chatHistoryId);
  }
}
