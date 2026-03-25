'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart3,
  MessageSquare,
  Clock,
  CheckCircle2,
  Bot,
  RefreshCw,
  Loader2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Skeleton,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  totalConversations: number;
  avgResponseTimeSec: number;
  resolutionRate: number;
  activeAgents: number;
}

interface ChannelBreakdown {
  channel: string;
  label: string;
  count: number;
}

interface TrendPoint {
  date: string;
  count: number;
}

interface AgentStat {
  agentId: string;
  agentName: string;
  conversations: number;
  avgMessages: number;
  lastActive: string | null;
}

interface AnalyticsData {
  summary: Summary;
  channels: ChannelBreakdown[];
  trend: TrendPoint[];
  agents: AgentStat[];
}

type DateRange = '7d' | '30d' | '90d';
type Scope = 'mine' | 'all';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateParams(range: DateRange): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  switch (range) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '90d':
      from.setDate(from.getDate() - 90);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatSeconds(sec: number): string {
  if (sec === 0) return '—';
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

const CHANNEL_COLORS: Record<string, string> = {
  command: 'bg-violet-500',
  telegram: 'bg-blue-500',
  line: 'bg-green-500',
  web: 'bg-cyan-500',
  api: 'bg-amber-500',
};

function channelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? 'bg-zinc-500';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCards({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  const cards = [
    {
      title: 'Total Conversations',
      value: summary ? summary.totalConversations.toLocaleString() : '—',
      icon: MessageSquare,
      description: 'Conversations in selected period',
    },
    {
      title: 'Avg Response Time',
      value: summary ? formatSeconds(summary.avgResponseTimeSec) : '—',
      icon: Clock,
      description: 'First agent reply after human message',
    },
    {
      title: 'Resolution Rate',
      value: summary ? formatPct(summary.resolutionRate) : '—',
      icon: CheckCircle2,
      description: 'Conversations with agent resolution',
    },
    {
      title: 'Active Agents',
      value: summary ? summary.activeAgents.toLocaleString() : '—',
      icon: Bot,
      description: 'Agents with conversations',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChannelChart({ channels }: { channels: ChannelBreakdown[] }) {
  if (channels.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No channel data available
      </div>
    );
  }

  const total = channels.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-3">
      {channels.map((c) => {
        const pct = total > 0 ? (c.count / total) * 100 : 0;
        return (
          <div key={c.channel} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-sm ${channelColor(c.channel)}`} />
                <span className="font-medium">{c.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  {c.count.toLocaleString()}
                </span>
                <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${channelColor(c.channel)} opacity-80`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0 || trend.every((t) => t.count === 0)) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No trend data for this period
      </div>
    );
  }

  const maxCount = Math.max(...trend.map((t) => t.count), 1);
  // Show at most 30 bars to avoid crowding
  const visible = trend.length > 30 ? trend.slice(-30) : trend;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5" style={{ height: '160px' }}>
        {visible.map((point) => {
          const heightPct = (point.count / maxCount) * 100;
          return (
            <div
              key={point.date}
              className="flex-1 flex flex-col justify-end group relative"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap pointer-events-none">
                <div className="bg-popover border rounded-md shadow-lg px-3 py-2 text-xs">
                  <div className="font-medium">{point.date}</div>
                  <div className="text-muted-foreground">
                    {point.count} conversation{point.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div
                className="w-full bg-primary/70 hover:bg-primary transition-colors rounded-t-sm"
                style={{ height: `${Math.max(heightPct, point.count > 0 ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Date labels — show start and end only */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{visible[0]?.date.slice(5)}</span>
        <span>{visible[visible.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function AgentTable({
  agents,
  loading,
}: {
  agents: AgentStat[];
  loading: boolean;
}) {
  if (!loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No agent data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="text-right">Conversations</TableHead>
            <TableHead className="text-right">Avg Messages</TableHead>
            <TableHead className="text-right">Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            : agents.map((agent) => (
                <TableRow key={agent.agentId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="font-medium text-sm">{agent.agentName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {agent.conversations.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {agent.avgMessages > 0 ? agent.avgMessages.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {agent.lastActive ? formatRelative(agent.lastActive) : '—'}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [scope, setScope] = useState<Scope>('all');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const { from, to } = getDateParams(dateRange);
        const params = new URLSearchParams({
          from,
          to,
          scope,
        });
        const result = await api.get<AnalyticsData>(
          `/api/v1/conversations/analytics?${params.toString()}`,
        );
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load analytics',
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [dateRange, scope],
  );

  // Initial load + re-fetch on filter change
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Real-time polling every 30 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchData(false);
    }, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Conversation Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Metrics, channel breakdown, and agent performance
            {lastUpdated && (
              <span className="ml-2 text-xs opacity-60">
                · Updated {formatRelative(lastUpdated.toISOString())}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date range */}
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
              className="h-8 text-xs"
            >
              Last {range.replace('d', 'd')}
            </Button>
          ))}
        </div>

        {/* Scope tabs */}
        <Tabs
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              All Users
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Mine
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={data?.summary ?? null} loading={loading} />

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Channel breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Channel Breakdown
            </CardTitle>
            <CardDescription>
              Conversations by messaging channel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <ChannelChart channels={data?.channels ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Trend chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Conversation Trend
            </CardTitle>
            <CardDescription>
              Daily conversation volume — hover bars for details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-end gap-0.5 h-40">
                {Array.from({ length: 20 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${20 + Math.random() * 80}%` }}
                  />
                ))}
              </div>
            ) : (
              <TrendChart trend={data?.trend ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent performance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Agent Performance
          </CardTitle>
          <CardDescription>
            Conversation counts and activity per agent
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentTable agents={data?.agents ?? []} loading={loading} />
        </CardContent>
      </Card>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Live — auto-refreshes every 30 seconds
      </div>
    </div>
  );
}
