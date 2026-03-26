'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Hash, Zap, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button,
  Tabs, TabsList, TabsTrigger,
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
  Badge,
  Skeleton,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { useLicense } from '@/hooks/use-license';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface UsageRow {
  date: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestCount: number;
}

interface UsageResponse {
  period: string;
  data: UsageRow[];
  totals: {
    totalTokens: number;
    estimatedCost: number;
    requestCount: number;
  };
}

type Period = 'daily' | 'weekly' | 'monthly';
type DateRange = '7d' | '30d' | '90d';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(n: number): string {
  if (n === 0) return '$0.00';
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(2)}`;
}

function getDateRangeParams(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);
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
  return { from: from.toISOString(), to };
}

/** Provider color mapping for the bar chart. */
const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-500',
  anthropic: 'bg-orange-500',
  deepseek: 'bg-zinc-500',
  groq: 'bg-purple-500',
  gemini: 'bg-yellow-500',
  mistral: 'bg-red-500',
  xai: 'bg-cyan-500',
  openrouter: 'bg-pink-500',
  together: 'bg-zinc-500',
  fireworks: 'bg-amber-500',
  cohere: 'bg-teal-500',
  moonshot: 'bg-violet-500',
  ollama: 'bg-gray-500',
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? 'bg-zinc-500';
}

// ── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ totals, loading }: {
  totals: UsageResponse['totals'] | null;
  loading: boolean;
}) {
  const cards = [
    {
      title: 'Total Tokens',
      value: totals ? formatTokens(totals.totalTokens) : '-',
      icon: Zap,
      description: 'Prompt + completion tokens',
    },
    {
      title: 'Estimated Cost',
      value: totals ? formatCost(totals.estimatedCost) : '-',
      icon: DollarSign,
      description: 'Based on provider pricing',
    },
    {
      title: 'Total Requests',
      value: totals ? totals.requestCount.toLocaleString() : '-',
      icon: Hash,
      description: 'API calls made',
    },
    {
      title: 'Avg Cost / Request',
      value: totals && totals.requestCount > 0
        ? formatCost(totals.estimatedCost / totals.requestCount)
        : '-',
      icon: BarChart3,
      description: 'Cost per API call',
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

// ── Bar Chart (CSS only) ─────────────────────────────────────────────────────

function UsageBarChart({ data }: { data: UsageRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No usage data for this period
      </div>
    );
  }

  // Group by date, summing tokens across providers
  const byDate = new Map<string, { tokens: number; cost: number; providers: Map<string, number> }>();
  for (const row of data) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { tokens: 0, cost: 0, providers: new Map() });
    }
    const entry = byDate.get(row.date)!;
    entry.tokens += row.totalTokens;
    entry.cost += row.estimatedCost;
    entry.providers.set(
      row.provider,
      (entry.providers.get(row.provider) ?? 0) + row.totalTokens,
    );
  }

  const dates = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const maxTokens = Math.max(...dates.map(([, d]) => d.tokens), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1" style={{ height: '160px' }}>
        {dates.map(([date, info]) => {
          const heightPct = (info.tokens / maxTokens) * 100;
          // Stack bars by provider
          const providerEntries = Array.from(info.providers.entries());
          return (
            <div
              key={date}
              className="flex-1 flex flex-col justify-end group relative"
              style={{ height: '100%' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap">
                <div className="bg-popover border rounded-md shadow-lg px-3 py-2 text-xs">
                  <div className="font-medium">{date}</div>
                  <div className="text-muted-foreground">
                    {formatTokens(info.tokens)} tokens &middot; {formatCost(info.cost)}
                  </div>
                </div>
              </div>
              {/* Stacked bar */}
              <div className="w-full rounded-t-sm overflow-hidden" style={{ height: `${Math.max(heightPct, 2)}%` }}>
                {providerEntries.map(([provider, tokens]) => {
                  const segmentPct = (tokens / info.tokens) * 100;
                  return (
                    <div
                      key={provider}
                      className={`w-full ${getProviderColor(provider)} opacity-80 hover:opacity-100 transition-opacity`}
                      style={{ height: `${segmentPct}%`, minHeight: '2px' }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {/* Date labels */}
      <div className="flex gap-1">
        {dates.map(([date]) => (
          <div key={date} className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground truncate block">
              {date.length > 7 ? date.slice(5) : date}
            </span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2">
        {Array.from(
          new Set(data.map((d) => d.provider)),
        ).map((provider) => (
          <div key={provider} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${getProviderColor(provider)}`} />
            <span className="text-xs text-muted-foreground">{provider}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Usage Table ──────────────────────────────────────────────────────────────

function UsageTable({ data }: { data: UsageRow[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No usage records found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Prompt</TableHead>
            <TableHead className="text-right">Completion</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Requests</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={`${row.date}-${row.provider}-${row.model}-${i}`}>
              <TableCell className="font-mono text-xs">{row.date}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {row.provider}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                {row.model}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatTokens(row.promptTokens)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatTokens(row.completionTokens)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs font-medium">
                {formatTokens(row.totalTokens)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {row.estimatedCost === 0 ? (
                  <span className="text-muted-foreground">free</span>
                ) : (
                  formatCost(row.estimatedCost)
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {row.requestCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AiUsageAnalyticsPage() {
  const { isPro } = useLicense();
  const [period, setPeriod] = useState<Period>('daily');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isPro) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/settings/ai">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
          </Link>
          <h1 className="text-2xl font-bold">Usage Analytics</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-12 w-12 text-amber-500 mb-4" />
            <h2 className="text-lg font-semibold">Pro Feature</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              AI Usage Analytics with daily, weekly, and monthly cost tracking is available on Pro and Enterprise plans.
            </p>
            <Link href="/settings/license" className="mt-4">
              <Button>Upgrade to Pro</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRangeParams(dateRange);
      const result = await api.get<UsageResponse>(
        `/api/proxy/ai/usage/analytics?period=${period}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, dateRange]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings/ai">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              AI Usage Analytics
            </h1>
            <p className="text-muted-foreground text-sm">
              Token consumption and cost tracking across all providers
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsage} disabled={loading}>
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
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <SummaryCards totals={data?.totals ?? null} loading={loading} />

      {/* Controls: Period + Date Range */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange(range)}
              className="h-8 text-xs"
            >
              Last {range.replace('d', ' days')}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Usage Over Time</CardTitle>
          <CardDescription>
            {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'} token
            consumption — hover bars for details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <UsageBarChart data={data?.data ?? []} />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage Breakdown</CardTitle>
          <CardDescription>
            Detailed breakdown by date, provider, and model
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <UsageTable data={data?.data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
