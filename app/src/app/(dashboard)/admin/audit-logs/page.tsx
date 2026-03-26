'use client';

import { useEffect, useState } from 'react';
import { Loader2, ScrollText } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  resource: string;
  timestamp: string;
  details?: string;
}

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  LOGIN: 'outline',
  LOGOUT: 'outline',
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AuditEntry[] | { data: AuditEntry[] }>('/api/v1/admin/audit-logs')
      .then((res) => {
        const data = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setLogs(data);
      })
      .catch((err) => {
        setLogs([]);
        toast({ title: 'Failed to load audit logs', description: err instanceof Error ? err.message : 'Error loading data', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            Track all platform actions and changes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading audit logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No audit logs available. The audit log API endpoint may not be
              available yet.
            </p>
          ) : (
            {/* Mobile card view */}
            <div className="block md:hidden space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={ACTION_VARIANT[log.action] ?? 'outline'}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium">{log.actor}</div>
                  <div className="text-sm text-muted-foreground">{log.resource}</div>
                  {log.details && (
                    <div className="text-sm text-muted-foreground truncate">{log.details}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant={ACTION_VARIANT[log.action] ?? 'outline'}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.actor}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.resource}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.details ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
