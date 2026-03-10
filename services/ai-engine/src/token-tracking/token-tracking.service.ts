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
    'text-embedding-3-small': { inputPer1M: 0.02, outputPer1M: 0 },
    'text-embedding-3-large': { inputPer1M: 0.13, outputPer1M: 0 },
    default: { inputPer1M: 2.5, outputPer1M: 10.0 },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
    'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
    'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
    default: { inputPer1M: 3.0, outputPer1M: 15.0 },
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
