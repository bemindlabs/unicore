import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ConversationSummary {
  totalConversations: number;
  avgResponseTimeSec: number;
  resolutionRate: number;
  activeAgents: number;
}

export interface ChannelBreakdown {
  channel: string;
  label: string;
  count: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface AgentStat {
  agentId: string;
  agentName: string;
  conversations: number;
  avgMessages: number;
  lastActive: string | null;
}

export interface ConversationsAnalyticsResult {
  summary: ConversationSummary;
  channels: ChannelBreakdown[];
  trend: TrendPoint[];
  agents: AgentStat[];
}

const CHANNEL_LABELS: Record<string, string> = {
  command: 'Commander',
  telegram: 'Telegram',
  line: 'LINE',
  web: 'Web',
  api: 'API',
};

@Injectable()
export class ConversationsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(options: {
    userId?: string;
    from?: string;
    to?: string;
    days?: number;
  }): Promise<ConversationsAnalyticsResult> {
    const days = options.days ?? 30;
    const to = options.to ? new Date(options.to) : new Date();
    const from = options.from
      ? new Date(options.from)
      : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      createdAt: { gte: from, lte: to },
    };
    if (options.userId) where.userId = options.userId;

    const [summary, channels, trend, agents] = await Promise.all([
      this.computeSummary(where),
      this.computeChannels(where),
      this.computeTrend(where, from, to),
      this.computeAgents(where),
    ]);

    return { summary, channels, trend, agents };
  }

  private async computeSummary(
    where: Record<string, unknown>,
  ): Promise<ConversationSummary> {
    const [totalConversations, agentGroups, sample] = await Promise.all([
      this.prisma.chatHistory.count({ where }),
      this.prisma.chatHistory.groupBy({
        by: ['agentId'],
        where,
        _count: { agentId: true },
      }),
      // Sample last 200 records to compute response time & resolution rate
      this.prisma.chatHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { messages: true, summary: true },
      }),
    ]);

    const activeAgents = agentGroups.length;

    // Resolution rate: % of conversations that have a summary or last message from agent
    let resolvedCount = 0;
    let totalResponseSec = 0;
    let responseCount = 0;

    for (const record of sample) {
      const msgs = Array.isArray(record.messages) ? (record.messages as Array<{
        authorId?: string;
        authorType?: string;
        timestamp?: string;
      }>) : [];

      // Resolution: conversation has a summary or the last message is from agent
      const lastMsg = msgs[msgs.length - 1];
      const isResolved =
        !!record.summary ||
        (lastMsg &&
          lastMsg.authorId !== 'human-user' &&
          lastMsg.authorId !== 'user' &&
          lastMsg.authorType !== 'human');
      if (isResolved) resolvedCount++;

      // Response time: first agent reply timestamp - first human message timestamp
      const firstHuman = msgs.find(
        (m) => m.authorId === 'human-user' || m.authorId === 'user' || m.authorType === 'human',
      );
      const firstAgentAfterHuman =
        firstHuman &&
        msgs.find(
          (m, i) =>
            i > msgs.indexOf(firstHuman) &&
            m.authorId !== 'human-user' &&
            m.authorId !== 'user' &&
            m.authorType !== 'human',
        );

      if (
        firstHuman?.timestamp &&
        firstAgentAfterHuman?.timestamp
      ) {
        const diff =
          (new Date(firstAgentAfterHuman.timestamp).getTime() -
            new Date(firstHuman.timestamp).getTime()) /
          1000;
        if (diff > 0 && diff < 600) {
          totalResponseSec += diff;
          responseCount++;
        }
      }
    }

    const resolutionRate =
      sample.length > 0 ? resolvedCount / sample.length : 0;
    const avgResponseTimeSec =
      responseCount > 0 ? totalResponseSec / responseCount : 0;

    return {
      totalConversations,
      avgResponseTimeSec: Math.round(avgResponseTimeSec * 10) / 10,
      resolutionRate: Math.round(resolutionRate * 1000) / 1000,
      activeAgents,
    };
  }

  private async computeChannels(
    where: Record<string, unknown>,
  ): Promise<ChannelBreakdown[]> {
    const groups = await this.prisma.chatHistory.groupBy({
      by: ['channel'],
      where,
      _count: { channel: true },
      orderBy: { _count: { channel: 'desc' } },
    });

    return groups.map((g) => ({
      channel: g.channel,
      label: CHANNEL_LABELS[g.channel] ?? g.channel,
      count: g._count.channel,
    }));
  }

  private async computeTrend(
    where: Record<string, unknown>,
    from: Date,
    to: Date,
  ): Promise<TrendPoint[]> {
    const records = await this.prisma.chatHistory.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Build a day-keyed map
    const dayMap = new Map<string, number>();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / dayMs);
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(from.getTime() + i * dayMs);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }

    for (const r of records) {
      const key = r.createdAt.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }

    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }

  private async computeAgents(
    where: Record<string, unknown>,
  ): Promise<AgentStat[]> {
    const [groups, lastActives] = await Promise.all([
      this.prisma.chatHistory.groupBy({
        by: ['agentId', 'agentName'],
        where,
        _count: { agentId: true },
        orderBy: { _count: { agentId: 'desc' } },
      }),
      // Get latest record per agent for lastActive
      this.prisma.chatHistory.findMany({
        where,
        select: { agentId: true, createdAt: true, messages: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ]);

    // Compute per-agent stats
    const agentLastActive = new Map<string, string>();
    const agentTotalMsgs = new Map<string, number>();
    const agentConvCount = new Map<string, number>();

    for (const r of lastActives) {
      if (!agentLastActive.has(r.agentId)) {
        agentLastActive.set(r.agentId, r.createdAt.toISOString());
      }
      const msgs = Array.isArray(r.messages) ? r.messages : [];
      agentTotalMsgs.set(
        r.agentId,
        (agentTotalMsgs.get(r.agentId) ?? 0) + msgs.length,
      );
      agentConvCount.set(r.agentId, (agentConvCount.get(r.agentId) ?? 0) + 1);
    }

    return groups.map((g) => {
      const count = g._count.agentId;
      const totalMsgs = agentTotalMsgs.get(g.agentId) ?? 0;
      const convCount = agentConvCount.get(g.agentId) ?? count;
      return {
        agentId: g.agentId,
        agentName: g.agentName,
        conversations: count,
        avgMessages:
          convCount > 0
            ? Math.round((totalMsgs / convCount) * 10) / 10
            : 0,
        lastActive: agentLastActive.get(g.agentId) ?? null,
      };
    });
  }
}
