'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  HardDrive,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Skeleton,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED' | 'ARCHIVED';
type TenantPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';

interface PlatformOverview {
  tenantCount: number;
  activeTenantCount: number;
  totalUserCount: number;
  activeSessionCount: number;
  storageUsageBytes: number;
  apiCallsToday: number;
  apiCallsThisMonth: number;
  newTenantsThisWeek: number;
  newUsersThisWeek: number;
  uptime: number;
  generatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  displayName?: string;
  plan: TenantPlan;
  status: TenantStatus;
  ownerEmail: string;
  memberCount: number;
  storageUsageBytes: number;
  apiCallsThisMonth: number;
  createdAt: string;
}

interface TenantList {
  items: Tenant[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PLAN_COLORS: Record<TenantPlan, string> = {
  STARTER: 'bg-blue-500',
  GROWTH: 'bg-violet-500',
  ENTERPRISE: 'bg-amber-500',
  CUSTOM: 'bg-pink-500',
};

const STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-500',
  SUSPENDED: 'bg-red-500',
  PENDING: 'bg-amber-500',
  DELETED: 'bg-gray-400',
  ARCHIVED: 'bg-gray-400',
};

// ---------------------------------------------------------------------------
// Distribution bar
// ---------------------------------------------------------------------------

function DistBar({ groups }: { groups: Array<{ label: string; count: number; total: number; color: string }> }) {
  return (
    <div className="space-y-3">
      {groups.map(({ label, count, total, color }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{count} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-N table
// ---------------------------------------------------------------------------

function TopTable({
  title,
  desc,
  rows,
  valueLabel,
  formatVal,
  icon: Icon,
}: {
  title: string;
  desc: string;
  rows: Array<{ id: string; name: string; value: number }>;
  valueLabel: string;
  formatVal: (v: number) => string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const max = rows[0]?.value ?? 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
        ) : (
          rows.map((row, idx) => (
            <div key={row.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs text-muted-foreground">{idx + 1}.</span>
                  <span className="font-medium truncate max-w-[160px]">{row.name}</span>
                </div>
                <span className="text-muted-foreground">{formatVal(row.value)}</span>
              </div>
              <Progress value={(row.value / max) * 100} className="h-1.5" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { label: string; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {(sub || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            {trend && (
              <Badge variant={trend.positive ? 'default' : 'destructive'} className="text-xs">
                <TrendingUp className="mr-1 h-3 w-3" />
                {trend.label}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [ov, tl] = await Promise.all([
        api.get<PlatformOverview>('/api/v1/admin/overview'),
        api.get<TenantList>('/api/v1/admin/tenants?limit=100'),
      ]);
      setOverview(ov);
      setTenants(tl.items ?? []);
    } catch (err) {
      toast({ title: 'Failed to load analytics', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ---- Computed distributions ----
  const total = tenants.length;

  const byPlan = (Object.keys(PLAN_COLORS) as TenantPlan[]).map((plan) => ({
    label: plan,
    count: tenants.filter((t) => t.plan === plan).length,
    total,
    color: PLAN_COLORS[plan],
  })).filter((g) => g.count > 0);

  const byStatus = (Object.keys(STATUS_COLORS) as TenantStatus[]).map((status) => ({
    label: status,
    count: tenants.filter((t) => t.status === status).length,
    total,
    color: STATUS_COLORS[status],
  })).filter((g) => g.count > 0);

  const topStorage = [...tenants]
    .sort((a, b) => b.storageUsageBytes - a.storageUsageBytes)
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.displayName ?? t.name, value: t.storageUsageBytes }));

  const topApi = [...tenants]
    .sort((a, b) => b.apiCallsThisMonth - a.apiCallsThisMonth)
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.displayName ?? t.name, value: t.apiCallsThisMonth }));

  const topUsers = [...tenants]
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.displayName ?? t.name, value: t.memberCount }));

  const avgStorage = total > 0
    ? tenants.reduce((s, t) => s + t.storageUsageBytes, 0) / total
    : 0;
  const avgApi = total > 0
    ? tenants.reduce((s, t) => s + t.apiCallsThisMonth, 0) / total
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cross-Tenant Analytics</h1>
            <p className="text-muted-foreground">Usage, revenue, and growth across all tenants</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          {overview && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Tenants"
                value={String(overview.tenantCount)}
                sub={`${overview.activeTenantCount} active`}
                icon={Users}
                trend={{ label: `+${overview.newTenantsThisWeek} this week`, positive: true }}
              />
              <StatCard
                title="Total Users"
                value={formatNumber(overview.totalUserCount)}
                sub="across all tenants"
                icon={Users}
                trend={{ label: `+${overview.newUsersThisWeek} this week`, positive: true }}
              />
              <StatCard
                title="Total Storage"
                value={formatBytes(overview.storageUsageBytes)}
                sub={`avg ${formatBytes(avgStorage)} / tenant`}
                icon={HardDrive}
              />
              <StatCard
                title="API Calls Today"
                value={formatNumber(overview.apiCallsToday)}
                sub={`${formatNumber(overview.apiCallsThisMonth)} this month`}
                icon={Zap}
              />
            </div>
          )}

          {/* Distribution charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tenants by Plan</CardTitle>
                <CardDescription>Distribution across subscription tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <DistBar groups={byPlan} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tenants by Status</CardTitle>
                <CardDescription>Active, suspended, and pending tenants</CardDescription>
              </CardHeader>
              <CardContent>
                <DistBar groups={byStatus} />
              </CardContent>
            </Card>
          </div>

          {/* Averages */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Storage / Tenant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatBytes(avgStorage)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg API Calls / Month</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatNumber(avgApi)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Members / Tenant</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {total > 0
                    ? (tenants.reduce((s, t) => s + t.memberCount, 0) / total).toFixed(1)
                    : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top-N tables */}
          <div className="grid gap-6 lg:grid-cols-3">
            <TopTable
              title="Top Storage Consumers"
              desc="Tenants using the most storage"
              rows={topStorage}
              valueLabel="Storage"
              formatVal={formatBytes}
              icon={HardDrive}
            />
            <TopTable
              title="Top API Users"
              desc="Highest API call volume this month"
              rows={topApi}
              valueLabel="API calls"
              formatVal={(v) => formatNumber(v)}
              icon={Zap}
            />
            <TopTable
              title="Largest Teams"
              desc="Tenants with the most members"
              rows={topUsers}
              valueLabel="Members"
              formatVal={(v) => String(v)}
              icon={Users}
            />
          </div>

          {!overview && total === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No analytics data available. The enterprise admin API may not be configured.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
