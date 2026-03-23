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
  avgResponseTimeSec: number;
  lastActive: string | null;
}

export interface ConversationsAnalyticsResult {
  summary: ConversationSummary;
  channels: ChannelBreakdown[];
  trend: TrendPoint[];
  agents: AgentStat[];
}

const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: 'Telegram',
  LINE: 'LINE',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  SLACK: 'Slack',
  DISCORD: 'Discord',
  EMAIL: 'Email',
  SMS: 'SMS',
  LIVE_CHAT: 'Live Chat',
};

@Injectable()
export class ConversationsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(options: {
    assigneeId?: string;
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
    if (options.assigneeId) where.assigneeId = options.assigneeId;

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
    const [total, resolvedCount, assignees, resolvedSample] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({
        where: { ...where, status: { in: ['RESOLVED', 'CLOSED'] } },
      }),
      this.prisma.conversation.groupBy({
        by: ['assigneeId'],
        where: { ...where, assigneeId: { not: null } },
        _count: { assigneeId: true },
      }),
      // Sample resolved conversations to compute avg response time
      this.prisma.conversation.findMany({
        where: {
          ...where,
          status: { in: ['RESOLVED', 'CLOSED'] },
          resolvedAt: { not: null },
        },
        select: { createdAt: true, resolvedAt: true },
        take: 500,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Avg response time: createdAt → resolvedAt for resolved conversations
    let totalSec = 0;
    let count = 0;
    for (const conv of resolvedSample) {
      if (conv.resolvedAt) {
        const diffSec =
          (conv.resolvedAt.getTime() - conv.createdAt.getTime()) / 1000;
        if (diffSec > 0) {
          totalSec += diffSec;
          count++;
        }
      }
    }

    return {
      totalConversations: total,
      avgResponseTimeSec:
        count > 0 ? Math.round((totalSec / count) * 10) / 10 : 0,
      resolutionRate:
        total > 0 ? Math.round((resolvedCount / total) * 1000) / 1000 : 0,
      activeAgents: assignees.length,
    };
  }

  private async computeChannels(
    where: Record<string, unknown>,
  ): Promise<ChannelBreakdown[]> {
    const groups = await this.prisma.conversation.groupBy({
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
    const records = await this.prisma.conversation.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / dayMs);

    const dayMap = new Map<string, number>();
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
    // Get participant stats from ConversationParticipant
    const [assigneeGroups, participantGroups] = await Promise.all([
      // Conversations grouped by assigneeId with latest activity
      this.prisma.conversation.groupBy({
        by: ['assigneeId'],
        where: { ...where, assigneeId: { not: null } },
        _count: { assigneeId: true },
        _max: { lastMessageAt: true, createdAt: true },
        orderBy: { _count: { assigneeId: 'desc' } },
      }),
      // Participant display names
      this.prisma.conversationParticipant.findMany({
        where: {
          conversation: where,
        },
        select: {
          participantId: true,
          participantName: true,
          participantType: true,
        },
        distinct: ['participantId'],
        take: 100,
      }),
    ]);

    const nameMap = new Map<string, string>();
    for (const p of participantGroups) {
      if (!nameMap.has(p.participantId)) {
        nameMap.set(p.participantId, p.participantName);
      }
    }

    // Also fetch resolved convs to compute per-agent response time
    const resolvedConvs = await this.prisma.conversation.findMany({
      where: {
        ...where,
        assigneeId: { not: null },
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null },
      },
      select: { assigneeId: true, createdAt: true, resolvedAt: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const agentResolved = new Map<string, { total: number; count: number }>();
    for (const conv of resolvedConvs) {
      if (!conv.assigneeId || !conv.resolvedAt) continue;
      const diffSec =
        (conv.resolvedAt.getTime() - conv.createdAt.getTime()) / 1000;
      if (diffSec <= 0) continue;
      const entry = agentResolved.get(conv.assigneeId) ?? {
        total: 0,
        count: 0,
      };
      entry.total += diffSec;
      entry.count++;
      agentResolved.set(conv.assigneeId, entry);
    }

    return assigneeGroups
      .filter((g) => g.assigneeId)
      .map((g) => {
        const id = g.assigneeId!;
        const resolved = agentResolved.get(id);
        return {
          agentId: id,
          agentName: nameMap.get(id) ?? id,
          conversations: g._count.assigneeId,
          avgResponseTimeSec:
            resolved && resolved.count > 0
              ? Math.round((resolved.total / resolved.count) * 10) / 10
              : 0,
          lastActive:
            (g._max.lastMessageAt ?? g._max.createdAt)?.toISOString() ?? null,
        };
      });
  }
}
