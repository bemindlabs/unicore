'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Network,
  RefreshCw,
  Server,
  XCircle,
  AlertTriangle,
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

type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs?: number;
  lastCheckedAt: string;
  errorMessage?: string;
}

interface ClusterNode {
  nodeId: string;
  host: string;
  role: 'primary' | 'replica' | 'worker';
  status: ServiceStatus;
  cpuPercent: number;
  memoryPercent: number;
  uptime: number;
}

interface SystemHealth {
  overallStatus: ServiceStatus;
  services: ServiceHealth[];
  clusterNodes: ClusterNode[];
  checkedAt: string;
}

interface SystemMetrics {
  cpu: { usagePercent: number; coreCount: number; loadAvg: [number, number, number] };
  memory: { totalBytes: number; usedBytes: number; freeBytes: number; usagePercent: number };
  disk: { totalBytes: number; usedBytes: number; freeBytes: number; usagePercent: number };
  network: { activeConnections: number; bytesInPerSecond: number; bytesOutPerSecond: number };
  database: { activeConnections: number; maxConnections: number; queryLatencyP99Ms: number };
  collectedAt: string;
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
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const STATUS_CONFIG: Record<ServiceStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  HEALTHY: { label: 'Healthy', icon: CheckCircle2, className: 'text-emerald-600', badgeVariant: 'default' },
  DEGRADED: { label: 'Degraded', icon: AlertTriangle, className: 'text-amber-600', badgeVariant: 'secondary' },
  UNHEALTHY: { label: 'Unhealthy', icon: XCircle, className: 'text-red-600', badgeVariant: 'destructive' },
  UNKNOWN: { label: 'Unknown', icon: Activity, className: 'text-gray-400', badgeVariant: 'outline' },
};

// ---------------------------------------------------------------------------
// Service Health Card
// ---------------------------------------------------------------------------

function ServiceCard({ service }: { service: ServiceHealth }) {
  const cfg = STATUS_CONFIG[service.status];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${cfg.className}`} />
        <div>
          <p className="text-sm font-medium capitalize">{service.name}</p>
          {service.errorMessage && (
            <p className="text-xs text-red-600 mt-0.5">{service.errorMessage}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Checked {new Date(service.lastCheckedAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {service.latencyMs !== undefined && (
          <span className="text-xs text-muted-foreground">{service.latencyMs}ms</span>
        )}
        <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Gauge
// ---------------------------------------------------------------------------

function MetricGauge({ label, value, max, format, icon: Icon }: {
  label: string;
  value: number;
  max: number;
  format: (v: number) => string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <span className={`font-semibold ${color}`}>{pct.toFixed(1)}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{format(value)} used</span>
        <span>{format(max)} total</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall status banner
// ---------------------------------------------------------------------------

function OverallBanner({ status }: { status: ServiceStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const bg: Record<ServiceStatus, string> = {
    HEALTHY: 'bg-emerald-50 border-emerald-200',
    DEGRADED: 'bg-amber-50 border-amber-200',
    UNHEALTHY: 'bg-red-50 border-red-200',
    UNKNOWN: 'bg-gray-50 border-gray-200',
  };

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${bg[status]}`}>
      <Icon className={`h-6 w-6 ${cfg.className}`} />
      <div>
        <p className="font-semibold">Platform is {cfg.label}</p>
        <p className="text-sm text-muted-foreground">Overall system status</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlatformHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [h, m] = await Promise.all([
        api.get<SystemHealth>('/api/v1/admin/health'),
        api.get<SystemMetrics>('/api/v1/admin/metrics'),
      ]);
      setHealth(h);
      setMetrics(m);
    } catch (err) {
      toast({ title: 'Failed to load health data', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Health Monitor</h1>
            <p className="text-muted-foreground">Service status and system resource metrics</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-32 mb-3" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Overall status */}
          {health && (
            <div className="space-y-3">
              <OverallBanner status={health.overallStatus} />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last checked: {new Date(health.checkedAt).toLocaleString()}
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Services
                </CardTitle>
                <CardDescription>
                  {health?.services.length ?? 0} services monitored
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {health?.services.length ? (
                  health.services.map((s) => <ServiceCard key={s.name} service={s} />)
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No services reported.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* System metrics */}
            <div className="space-y-4">
              {metrics && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        System Resources
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <MetricGauge
                        label="CPU"
                        value={metrics.cpu.usagePercent}
                        max={100}
                        format={(v) => `${v.toFixed(1)}%`}
                        icon={Cpu}
                      />
                      <MetricGauge
                        label="Memory"
                        value={metrics.memory.usedBytes}
                        max={metrics.memory.totalBytes}
                        format={formatBytes}
                        icon={Activity}
                      />
                      <MetricGauge
                        label="Disk"
                        value={metrics.disk.usedBytes}
                        max={metrics.disk.totalBytes}
                        format={formatBytes}
                        icon={HardDrive}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Network className="h-4 w-4" />
                        Network & Database
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { label: 'Active Connections', value: String(metrics.network.activeConnections), icon: Network },
                          { label: 'Inbound', value: `${formatBytes(metrics.network.bytesInPerSecond)}/s`, icon: Network },
                          { label: 'Outbound', value: `${formatBytes(metrics.network.bytesOutPerSecond)}/s`, icon: Network },
                          {
                            label: 'DB Connections',
                            value: `${metrics.database.activeConnections} / ${metrics.database.maxConnections}`,
                            icon: Database,
                          },
                          {
                            label: 'Query P99',
                            value: `${metrics.database.queryLatencyP99Ms}ms`,
                            icon: Database,
                          },
                          {
                            label: 'Load Avg',
                            value: metrics.cpu.loadAvg.map((v) => v.toFixed(2)).join(' / '),
                            icon: Cpu,
                          },
                        ].map(({ label, value, icon: Icon }) => (
                          <div key={label} className="rounded-lg border p-3">
                            <div className="flex items-center gap-1 mb-1">
                              <Icon className="h-3 w-3 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                            <p className="text-sm font-semibold">{value}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {/* Cluster nodes */}
          {health?.clusterNodes.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Cluster Nodes
                </CardTitle>
                <CardDescription>{health.clusterNodes.length} nodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Node</th>
                        <th className="pb-2 pr-4 font-medium">Host</th>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 pr-4 font-medium text-right">CPU</th>
                        <th className="pb-2 pr-4 font-medium text-right">Memory</th>
                        <th className="pb-2 font-medium text-right">Uptime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.clusterNodes.map((node) => {
                        const cfg = STATUS_CONFIG[node.status];
                        const Icon = cfg.icon;
                        return (
                          <tr key={node.nodeId} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs">{node.nodeId}</td>
                            <td className="py-2 pr-4 text-muted-foreground">{node.host}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs capitalize">{node.role}</Badge>
                            </td>
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1">
                                <Icon className={`h-3.5 w-3.5 ${cfg.className}`} />
                                <span className="text-xs">{cfg.label}</span>
                              </div>
                            </td>
                            <td className="py-2 pr-4 text-right">{node.cpuPercent.toFixed(1)}%</td>
                            <td className="py-2 pr-4 text-right">{node.memoryPercent.toFixed(1)}%</td>
                            <td className="py-2 text-right text-muted-foreground">{formatUptime(node.uptime)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!health && !metrics && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Health and metrics endpoints are not yet available.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

