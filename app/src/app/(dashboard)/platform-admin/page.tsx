'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  Globe,
  HardDrive,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  href?: string;
}

function KpiCard({ title, value, sub, icon: Icon, trend, href }: KpiCardProps) {
  const content = (
    <Card className={href ? 'hover:shadow-md transition-shadow' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {trend && (
            <Badge variant="secondary" className="text-xs">
              <TrendingUp className="mr-1 h-3 w-3" />
              {trend}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quick links
// ---------------------------------------------------------------------------

const QUICK_LINKS = [
  { label: 'Manage Tenants', href: '/platform-admin/tenants', icon: Users, desc: 'View, suspend, and provision tenants' },
  { label: 'Health Monitor', href: '/platform-admin/health', icon: Activity, desc: 'Service health and system metrics' },
  { label: 'Analytics', href: '/platform-admin/analytics', icon: BarChart3, desc: 'Cross-tenant usage and growth trends' },
  { label: 'Platform Settings', href: '/platform-admin/settings', icon: Globe, desc: 'Quotas, feature flags, and defaults' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlatformAdminPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PlatformOverview>('/api/v1/admin/overview')
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-muted-foreground">
            Enterprise admin dashboard — real-time platform health and metrics
          </p>
        </div>
        {overview && (
          <Badge variant="outline" className="ml-auto text-xs">
            <Clock className="mr-1 h-3 w-3" />
            Updated {new Date(overview.generatedAt).toLocaleTimeString()}
          </Badge>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : overview ? (
          <>
            <KpiCard
              title="Total Tenants"
              value={String(overview.tenantCount)}
              sub={`${overview.activeTenantCount} active`}
              icon={Users}
              trend={`+${overview.newTenantsThisWeek} this week`}
              href="/platform-admin/tenants"
            />
            <KpiCard
              title="Total Users"
              value={formatNumber(overview.totalUserCount)}
              sub={`${overview.activeSessionCount} active sessions`}
              icon={Users}
              trend={`+${overview.newUsersThisWeek} this week`}
            />
            <KpiCard
              title="Storage Used"
              value={formatBytes(overview.storageUsageBytes)}
              sub="across all tenants"
              icon={HardDrive}
            />
            <KpiCard
              title="API Calls Today"
              value={formatNumber(overview.apiCallsToday)}
              sub={`${formatNumber(overview.apiCallsThisMonth)} this month`}
              icon={Zap}
            />
            <KpiCard
              title="Uptime"
              value={formatUptime(overview.uptime)}
              sub="platform availability"
              icon={Activity}
              href="/platform-admin/health"
            />
            <KpiCard
              title="Active Sessions"
              value={String(overview.activeSessionCount)}
              sub="logged-in users now"
              icon={Users}
            />
            <KpiCard
              title="New Tenants"
              value={String(overview.newTenantsThisWeek)}
              sub="this week"
              icon={TrendingUp}
            />
            <KpiCard
              title="New Users"
              value={String(overview.newUsersThisWeek)}
              sub="this week"
              icon={TrendingUp}
            />
          </>
        ) : (
          <div className="col-span-4 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Could not load platform overview. The enterprise admin API may not be available.
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ label, href, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs">{desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
