import { Injectable, Logger } from '@nestjs/common';
import { LlmUsage } from '../llm/interfaces/llm-provider.interface';

export interface TokenUsageRecord {
  id: string;
  tenantId?: string;
  agentId?: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  operation: 'complete' | 'stream' | 'embed';
  latencyMs?: number;
  cost?: number;
  recordedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  estimatedCostUsd: number;
  byProvider: Record<
    string,
    {
      requests: number;
      tokens: number;
      estimatedCostUsd: number;
    }
  >;
  byModel: Record<
    string,
    {
      requests: number;
      tokens: number;
    }
  >;
}

export type UsagePeriod = 'daily' | 'weekly' | 'monthly';

export interface AggregatedUsageRow {
  date: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
}

export interface AggregatedUsageResponse {
  period: UsagePeriod;
  data: AggregatedUsageRow[];
  totals: {
    totalTokens: number;
    estimatedCost: number;
    requestCount: number;
  };
}

export interface TrackUsageDto {
  provider: string;
  model: string;
  usage: LlmUsage;
  operation: TokenUsageRecord['operation'];
  tenantId?: string;
  agentId?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Per-million-token cost in USD (input / output).
 * These are approximate list prices and should be updated as pricing changes.
 */
const PROVIDER_COSTS: Record<
  string,
  Record<string, { inputPer1M: number; outputPer1M: number }>
> = {
  openai: {
    'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
    'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gpt-4-turbo': { inputPer1M: 10.0, outputPer1M: 30.0 },
    'o3-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
    'o4-mini': { inputPer1M: 1.1, outputPer1M: 4.4 },
    'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
    'text-embedding-3-large': { inputPer1M: 0.13, outputPer1M: 0 },
    default: { inputPer1M: 2.5, outputPer1M: 10.0 },
  },
  anthropic: {
    'claude-sonnet-4-20250514': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'claude-opus-4-20250514': { inputPer1M: 15.0, outputPer1M: 75.0 },
    'claude-haiku-4-5-20251001': { inputPer1M: 0.8, outputPer1M: 4.0 },
    'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
    'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
    default: { inputPer1M: 3.0, outputPer1M: 15.0 },
  },
  deepseek: {
    'deepseek-chat': { inputPer1M: 0.14, outputPer1M: 0.28 },
    'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19 },
    default: { inputPer1M: 0.14, outputPer1M: 0.28 },
  },
  groq: {
    'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
    'llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
    'mixtral-8x7b-32768': { inputPer1M: 0.24, outputPer1M: 0.24 },
    default: { inputPer1M: 0.59, outputPer1M: 0.79 },
  },
  gemini: {
    'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10.0 },
    'gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
    default: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  mistral: {
    'mistral-large-latest': { inputPer1M: 2.0, outputPer1M: 6.0 },
    'mistral-small-latest': { inputPer1M: 0.2, outputPer1M: 0.6 },
    'codestral-latest': { inputPer1M: 0.3, outputPer1M: 0.9 },
    default: { inputPer1M: 2.0, outputPer1M: 6.0 },
  },
  xai: {
    'grok-3': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'grok-3-mini': { inputPer1M: 0.3, outputPer1M: 0.5 },
    'grok-3-fast': { inputPer1M: 5.0, outputPer1M: 25.0 },
    default: { inputPer1M: 3.0, outputPer1M: 15.0 },
  },
  openrouter: {
    default: { inputPer1M: 2.5, outputPer1M: 10.0 }, // varies by model
  },
  together: {
    default: { inputPer1M: 0.2, outputPer1M: 0.2 },
  },
  fireworks: {
    default: { inputPer1M: 0.2, outputPer1M: 0.2 },
  },
  cohere: {
    'command-r-plus': { inputPer1M: 2.5, outputPer1M: 10.0 },
    'command-r': { inputPer1M: 0.15, outputPer1M: 0.6 },
    'command-light': { inputPer1M: 0.08, outputPer1M: 0.08 },
    default: { inputPer1M: 0.15, outputPer1M: 0.6 },
  },
  moonshot: {
    default: { inputPer1M: 1.0, outputPer1M: 1.0 },
  },
  ollama: {
    default: { inputPer1M: 0, outputPer1M: 0 }, // local — no cost
  },
};

@Injectable()
export class TokenTrackingService {
  private readonly logger = new Logger(TokenTrackingService.name);

  /**
   * In-memory ring buffer (last 10 000 records).
   * Production deployments should persist records to PostgreSQL.
   */
  private readonly records: TokenUsageRecord[] = [];
  private readonly MAX_RECORDS = 10_000;
  private recordCounter = 0;

  track(dto: TrackUsageDto): TokenUsageRecord {
    const cost = this.estimateCost(dto.provider, dto.model, dto.usage);

    const record: TokenUsageRecord = {
      id: `tok_${(++this.recordCounter).toString().padStart(8, '0')}`,
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      provider: dto.provider,
      model: dto.model,
      promptTokens: dto.usage.promptTokens,
      completionTokens: dto.usage.completionTokens,
      totalTokens: dto.usage.totalTokens,
      operation: dto.operation,
      latencyMs: dto.latencyMs,
      cost,
      recordedAt: new Date(),
      metadata: dto.metadata,
    };

    if (this.records.length >= this.MAX_RECORDS) {
      this.records.shift(); // evict oldest
    }
    this.records.push(record);

    this.logger.debug(
      `Tracked ${dto.operation} — provider=${dto.provider} model=${dto.model} ` +
        `tokens=${dto.usage.totalTokens} cost=$${cost.toFixed(6)}`,
    );

    return record;
  }

  getStats(filter?: {
    tenantId?: string;
    agentId?: string;
    provider?: string;
    since?: Date;
  }): UsageStats {
    let filtered = [...this.records];

    if (filter?.tenantId) {
      filtered = filtered.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.agentId) {
      filtered = filtered.filter((r) => r.agentId === filter.agentId);
    }
    if (filter?.provider) {
      filtered = filtered.filter((r) => r.provider === filter.provider);
    }
    if (filter?.since) {
      filtered = filtered.filter((r) => r.recordedAt >= filter.since!);
    }

    const byProvider: UsageStats['byProvider'] = {};
    const byModel: UsageStats['byModel'] = {};

    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;

    for (const r of filtered) {
      totalTokens += r.totalTokens;
      totalPromptTokens += r.promptTokens;
      totalCompletionTokens += r.completionTokens;
      totalCost += r.cost ?? 0;

      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { requests: 0, tokens: 0, estimatedCostUsd: 0 };
      }
      byProvider[r.provider].requests++;
      byProvider[r.provider].tokens += r.totalTokens;
      byProvider[r.provider].estimatedCostUsd += r.cost ?? 0;

      if (!byModel[r.model]) {
        byModel[r.model] = { requests: 0, tokens: 0 };
      }
      byModel[r.model].requests++;
      byModel[r.model].tokens += r.totalTokens;
    }

    return {
      totalRequests: filtered.length,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      estimatedCostUsd: totalCost,
      byProvider,
      byModel,
    };
  }

  getRecords(limit = 100, offset = 0): TokenUsageRecord[] {
    return this.records.slice(offset, offset + limit);
  }

  /**
   * Aggregate usage records by period (daily/weekly/monthly) within a date range.
   * Groups by date bucket + provider + model.
   */
  getAggregatedUsage(options: {
    period: UsagePeriod;
    from?: Date;
    to?: Date;
    tenantId?: string;
    provider?: string;
  }): AggregatedUsageResponse {
    const { period, from, to, tenantId, provider } = options;
    let filtered = [...this.records];

    if (from) {
      filtered = filtered.filter((r) => r.recordedAt >= from);
    }
    if (to) {
      filtered = filtered.filter((r) => r.recordedAt <= to);
    }
    if (tenantId) {
      filtered = filtered.filter((r) => r.tenantId === tenantId);
    }
    if (provider) {
      filtered = filtered.filter((r) => r.provider === provider);
    }

    // Build aggregation buckets keyed by "dateKey|provider|model"
    const buckets = new Map<string, AggregatedUsageRow>();

    for (const r of filtered) {
      const dateKey = this.getDateKey(r.recordedAt, period);
      const key = `${dateKey}|${r.provider}|${r.model}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          date: dateKey,
          provider: r.provider,
          model: r.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          requestCount: 0,
        });
      }

      const bucket = buckets.get(key)!;
      bucket.promptTokens += r.promptTokens;
      bucket.completionTokens += r.completionTokens;
      bucket.totalTokens += r.totalTokens;
      bucket.estimatedCost += r.cost ?? 0;
      bucket.requestCount += 1;
    }

    const data = Array.from(buckets.values()).sort((a, b) =>
      a.date.localeCompare(b.date) || a.provider.localeCompare(b.provider),
    );

    // Round cost values
    for (const row of data) {
      row.estimatedCost = Math.round(row.estimatedCost * 1_000_000) / 1_000_000;
    }

    const totals = {
      totalTokens: data.reduce((sum, d) => sum + d.totalTokens, 0),
      estimatedCost:
        Math.round(
          data.reduce((sum, d) => sum + d.estimatedCost, 0) * 1_000_000,
        ) / 1_000_000,
      requestCount: data.reduce((sum, d) => sum + d.requestCount, 0),
    };

    return { period, data, totals };
  }

  /** Map a Date to a bucket key string based on the period. */
  private getDateKey(date: Date, period: UsagePeriod): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    switch (period) {
      case 'daily':
        return `${y}-${m}-${d}`;
      case 'weekly': {
        // ISO week: find the Monday of the week
        const dt = new Date(date);
        const day = dt.getDay();
        const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
        dt.setDate(diff);
        const wy = dt.getFullYear();
        const wm = String(dt.getMonth() + 1).padStart(2, '0');
        const wd = String(dt.getDate()).padStart(2, '0');
        return `${wy}-${wm}-${wd}`;
      }
      case 'monthly':
        return `${y}-${m}`;
      default:
        return `${y}-${m}-${d}`;
    }
  }

  estimateCost(provider: string, model: string, usage: LlmUsage): number {
    const providerPricing = PROVIDER_COSTS[provider] ?? PROVIDER_COSTS['openai'];
    const modelPricing = providerPricing[model] ?? providerPricing['default'];

    if (!modelPricing) return 0;

    const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.inputPer1M;
    const outputCost =
      (usage.completionTokens / 1_000_000) * modelPricing.outputPer1M;

    return inputCost + outputCost;
  }
}
