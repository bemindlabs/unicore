'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  version?: string;
}

interface HealthResponse {
  services: ServiceHealth[];
  uptime?: number;
}

const STATUS_CONFIG = {
  healthy: { label: 'Healthy', variant: 'default' as const, Icon: CheckCircle },
  degraded: { label: 'Degraded', variant: 'secondary' as const, Icon: Activity },
  down: { label: 'Down', variant: 'destructive' as const, Icon: XCircle },
};

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<HealthResponse>('/api/v1/admin/health')
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Health</h1>
          <p className="text-muted-foreground">
            Monitor platform services and infrastructure
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Checking services...
        </p>
      ) : !health ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Health check endpoint not available. The admin health API may not
              be implemented yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {health.uptime !== undefined && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground">
                  Platform uptime:{' '}
                  <span className="font-medium text-foreground">
                    {Math.floor(health.uptime / 3600)}h{' '}
                    {Math.floor((health.uptime % 3600) / 60)}m
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {health.services.map((svc) => {
              const cfg = STATUS_CONFIG[svc.status];
              const StatusIcon = cfg.Icon;
              return (
                <Card key={svc.name}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{svc.name}</CardTitle>
                      <Badge variant={cfg.variant}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {svc.latencyMs !== undefined && (
                        <span>{svc.latencyMs}ms</span>
                      )}
                      {svc.version && <span>v{svc.version}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
