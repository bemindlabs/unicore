import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  throttledCount?: number;
}

export interface AgentRateLimitMetrics {
  agentId: string;
  messagesInWindow: number;
  throttledCount: number;
  windowResetAt: string;
}

export interface ChannelRateLimitMetrics {
  channel: string;
  messagesInWindow: number;
  throttledCount: number;
  windowResetAt: string;
}

interface BucketState {
  tokens: number;
  lastRefillAt: number;
  messagesInWindow: number;
  throttledCount: number;
  windowStart: number;
}

/**
 * Token-bucket rate limiter for agent-to-agent WebSocket messages.
 *
 * Agent limit  : AGENT_RATE_LIMIT_PER_MINUTE (default 100/min), burst 20
 * Channel limit: 200 messages/minute aggregate across all publishers, burst 20
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  private readonly agentBuckets = new Map<string, BucketState>();
  private readonly channelBuckets = new Map<string, BucketState>();

  /** Burst capacity for agent buckets */
  private readonly agentBurstCapacity = 20;
  /** Burst capacity for channel buckets */
  private readonly channelBurstCapacity = 20;

  /** Refill rate in tokens per millisecond for agents */
  private readonly agentRefillRatePerMs: number;
  /** Refill rate in tokens per millisecond for channels (200/min) */
  private readonly channelRefillRatePerMs = 200 / 60 / 1000;

  constructor() {
    const ratePerMinute = parseInt(
      process.env['AGENT_RATE_LIMIT_PER_MINUTE'] ?? '100',
      10,
    );
    this.agentRefillRatePerMs = ratePerMinute / 60 / 1000;
  }

  /**
   * Check and consume one token from the agent's bucket.
   * Returns allowed=true if the message may proceed.
   */
  checkAgentLimit(agentId: string): RateLimitResult {
    const bucket = this.getOrCreate(this.agentBuckets, agentId, this.agentBurstCapacity);
    return this.consume(bucket, this.agentBurstCapacity, this.agentRefillRatePerMs);
  }

  /**
   * Check and consume one token from the channel's aggregate bucket.
   * Returns allowed=true if the message may proceed.
   */
  checkChannelLimit(channel: string): RateLimitResult {
    const bucket = this.getOrCreate(this.channelBuckets, channel, this.channelBurstCapacity);
    return this.consume(bucket, this.channelBurstCapacity, this.channelRefillRatePerMs);
  }

  /** Return per-agent rate-limit metrics for the metrics endpoint. */
  getAgentMetrics(): AgentRateLimitMetrics[] {
    const out: AgentRateLimitMetrics[] = [];
    for (const [agentId, b] of this.agentBuckets) {
      out.push({
        agentId,
        messagesInWindow: b.messagesInWindow,
        throttledCount: b.throttledCount,
        windowResetAt: new Date(b.windowStart + 60_000).toISOString(),
      });
    }
    return out;
  }

  /** Return per-channel rate-limit metrics. */
  getChannelMetrics(): ChannelRateLimitMetrics[] {
    const out: ChannelRateLimitMetrics[] = [];
    for (const [channel, b] of this.channelBuckets) {
      out.push({
        channel,
        messagesInWindow: b.messagesInWindow,
        throttledCount: b.throttledCount,
        windowResetAt: new Date(b.windowStart + 60_000).toISOString(),
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getOrCreate(
    map: Map<string, BucketState>,
    key: string,
    capacity: number,
  ): BucketState {
    let bucket = map.get(key);
    if (!bucket) {
      const now = Date.now();
      bucket = {
        tokens: capacity,
        lastRefillAt: now,
        messagesInWindow: 0,
        throttledCount: 0,
        windowStart: now,
      };
      map.set(key, bucket);
    }
    return bucket;
  }

  private consume(
    bucket: BucketState,
    capacity: number,
    refillRatePerMs: number,
  ): RateLimitResult {
    const now = Date.now();

    // Refill proportional to elapsed time
    const elapsed = now - bucket.lastRefillAt;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRatePerMs);
    bucket.lastRefillAt = now;

    // Roll over sliding window counter every minute
    if (now - bucket.windowStart >= 60_000) {
      bucket.messagesInWindow = 0;
      bucket.windowStart = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.messagesInWindow += 1;
      return { allowed: true };
    }

    bucket.throttledCount += 1;
    const retryAfterMs = (1 - bucket.tokens) / refillRatePerMs;
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    this.logger.warn(
      `Rate limit exceeded — key=${Array.from(this.agentBuckets.keys()).includes(
        Array.from(this.agentBuckets.entries()).find(([, b]) => b === bucket)?.[0] ?? '',
      )
        ? 'agent'
        : 'channel'}, retryAfter=${retryAfterSeconds}s, throttledTotal=${bucket.throttledCount}`,
    );

    return { allowed: false, retryAfterSeconds, throttledCount: bucket.throttledCount };
  }
}
