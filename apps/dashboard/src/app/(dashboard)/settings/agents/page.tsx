'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, RefreshCw, Loader2, Circle, Power, PowerOff, Trash2, Shield, Zap, TrendingUp, Mail, Search, Wrench, BarChart3, Database } from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button,
} from '@unicore/ui';
import { api } from '@/lib/api';

interface Agent {
  id: string;
  name: string;
  type: string;
  version: string;
  state: 'spawning' | 'running' | 'idle' | 'terminated';
  registeredAt: string;
  lastHeartbeatAt: string;
  capabilities: string[];
  tags: string[];
}

interface AgentSummary {
  status: string;
  total: number;
  byState: Record<string, number>;
  agents: Agent[];
}

interface HeartbeatStatus {
  status: string;
  heartbeat: {
    heartbeatIntervalMs: number;
    heartbeatTimeoutMs: number;
    running: boolean;
  };
}

interface ChannelInfo {
  status: string;
  channels: Record<string, string[]>;
}

const AGENT_ICONS: Record<string, typeof Bot> = {
  router: Zap,
  comms: Mail,
  finance: BarChart3,
  growth: TrendingUp,
  ops: Wrench,
  research: Search,
  sentinel: Shield,
  builder: Wrench,
  erp: Database,
};

const STATE_COLORS: Record<string, string> = {
  running: 'text-green-500',
  idle: 'text-yellow-500',
  spawning: 'text-blue-500',
  terminated: 'text-red-500',
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function AgentSettingsPage() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatStatus | null>(null);
  const [channels, setChannels] = useState<ChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentData, hbData, chData] = await Promise.all([
        api.get<AgentSummary>('/api/proxy/openclaw/health/agents'),
        api.get<HeartbeatStatus>('/api/proxy/openclaw/health/heartbeat'),
        api.get<ChannelInfo>('/api/proxy/openclaw/health/channels'),
      ]);
      setSummary(agentData);
      setHeartbeat(hbData);
      setChannels(chData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleDelete = async (agentId: string) => {
    try {
      await api.delete(`/api/proxy/openclaw/agents/${agentId}`);
      fetchAll();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">OpenClaw Agents</h1>
            <p className="text-muted-foreground">Monitor AI agents, heartbeat, and pub/sub channels</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: summary.total, color: '' },
            { label: 'Running', value: summary.byState.running ?? 0, color: 'text-green-500' },
            { label: 'Idle', value: summary.byState.idle ?? 0, color: 'text-yellow-500' },
            { label: 'Terminated', value: summary.byState.terminated ?? 0, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered Agents</CardTitle>
          <CardDescription>All agents in the OpenClaw gateway registry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary?.agents.map((agent) => {
              const Icon = AGENT_ICONS[agent.type] ?? Bot;
              return (
                <div key={agent.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{agent.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">v{agent.version}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Circle className={`h-2 w-2 fill-current ${STATE_COLORS[agent.state] ?? 'text-gray-400'}`} />
                        {agent.state}
                      </span>
                      <span>|</span>
                      <span>heartbeat {timeAgo(agent.lastHeartbeatAt)}</span>
                    </div>
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.capabilities.map((c) => (
                          <span key={c} className="inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {agent.state === 'terminated' && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => handleDelete(agent.id)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
            {(!summary || summary.agents.length === 0) && !loading && (
              <p className="text-center text-sm text-muted-foreground py-8">No agents registered</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Heartbeat Monitor</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {heartbeat && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="flex items-center gap-1">
                    {heartbeat.heartbeat.running ? <Power className="h-3 w-3 text-green-500" /> : <PowerOff className="h-3 w-3 text-red-500" />}
                    {heartbeat.heartbeat.running ? 'Active' : 'Stopped'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interval</span>
                  <span className="font-mono">{(heartbeat.heartbeat.heartbeatIntervalMs / 1000).toFixed(0)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timeout</span>
                  <span className="font-mono">{(heartbeat.heartbeat.heartbeatTimeoutMs / 1000).toFixed(0)}s</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Active Channels</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {channels && Object.entries(channels.channels).length > 0 ? (
              Object.entries(channels.channels).map(([channel, subscribers]) => (
                <div key={channel} className="flex justify-between">
                  <span className="font-mono text-xs truncate">{channel}</span>
                  <span className="text-muted-foreground text-xs">{(subscribers as string[]).length} sub</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">No active channels</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
