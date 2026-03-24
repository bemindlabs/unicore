'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot, RefreshCw, Loader2, Circle, Power, PowerOff, Trash2, Plus,
  Shield, Zap, TrendingUp, Mail, Search, Wrench, BarChart3, Database,
  Play, Pause, ChevronDown, ChevronRight, Save, AlertCircle,
} from 'lucide-react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label,
} from '@bemindlabs/unicore-ui';
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
  heartbeat: { heartbeatIntervalMs: number; heartbeatTimeoutMs: number; running: boolean };
}

const AGENT_ICONS: Record<string, typeof Bot> = {
  router: Zap, comms: Mail, finance: BarChart3, growth: TrendingUp,
  ops: Wrench, research: Search, sentinel: Shield, builder: Wrench, erp: Database,
};

const STATE_COLORS: Record<string, string> = {
  running: 'text-green-500', idle: 'text-yellow-500',
  spawning: 'text-blue-500', terminated: 'text-red-500',
};

const AGENT_TYPES = ['router', 'comms', 'finance', 'growth', 'ops', 'research', 'sentinel', 'builder', 'erp', 'custom'];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function AgentSettingsPage() {
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgent, setNewAgent] = useState({ id: '', name: '', type: 'custom', capabilities: '' });
  const [actionStatus, setActionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agentData, hbData] = await Promise.all([
        api.get<AgentSummary>('/api/proxy/openclaw/health/agents'),
        api.get<HeartbeatStatus>('/api/proxy/openclaw/health/heartbeat'),
      ]);
      setSummary(agentData);
      setHeartbeat(hbData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleToggleState = async (agent: Agent) => {
    const newState = agent.state === 'running' ? 'idle' : 'running';
    try {
      await api.put(`/api/proxy/openclaw/agents/${agent.id}`, { ...agent, state: newState });
      setActionStatus({ type: 'success', message: `${agent.name} ${newState === 'running' ? 'resumed' : 'paused'}` });
      fetchAll();
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm(`Remove agent "${agentId}"? It will be re-registered on next restart.`)) return;
    try {
      await api.delete(`/api/proxy/openclaw/agents/${agentId}`);
      setActionStatus({ type: 'success', message: `Agent ${agentId} removed` });
      fetchAll();
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleSaveAgent = async () => {
    if (!editingAgent) return;
    setSaving(true);
    try {
      await api.put(`/api/proxy/openclaw/agents/${editingAgent.id}`, editingAgent);
      setActionStatus({ type: 'success', message: `${editingAgent.name} updated` });
      setEditingAgent(null);
      setExpandedAgent(null);
      fetchAll();
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAgent = async () => {
    if (!newAgent.id.trim() || !newAgent.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/proxy/openclaw/health/agents/register', {
        agentId: newAgent.id,
        name: newAgent.name,
        type: newAgent.type,
        capabilities: newAgent.capabilities.split(',').map((c) => c.trim()).filter(Boolean),
      });
      setActionStatus({ type: 'success', message: `Agent ${newAgent.name} registered` });
      setShowAddForm(false);
      setNewAgent({ id: '', name: '', type: 'custom', capabilities: '' });
      fetchAll();
    } catch (err) {
      setActionStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">OpenClaw Agents</h1>
            <p className="text-muted-foreground">Configure, monitor, and manage AI agents</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-4 w-4 mr-1" /> Add Agent
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {actionStatus && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${actionStatus.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}`}>
          {actionStatus.type === 'error' && <AlertCircle className="h-4 w-4" />}
          {actionStatus.message}
          <button onClick={() => setActionStatus(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Add Agent Form */}
      {showAddForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Register New Agent</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Agent ID</Label>
                <Input value={newAgent.id} onChange={(e) => setNewAgent((p) => ({ ...p, id: e.target.value }))} placeholder="my-agent" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input value={newAgent.name} onChange={(e) => setNewAgent((p) => ({ ...p, name: e.target.value }))} placeholder="MY AGENT" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select value={newAgent.type} onChange={(e) => setNewAgent((p) => ({ ...p, type: e.target.value }))} className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  {AGENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Capabilities (comma-separated)</Label>
                <Input value={newAgent.capabilities} onChange={(e) => setNewAgent((p) => ({ ...p, capabilities: e.target.value }))} placeholder="messaging, email, notifications" className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddAgent} disabled={saving || !newAgent.id.trim()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Register
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Overview */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: summary.total, color: '' },
            { label: 'Running', value: summary.byState.running ?? 0, color: 'text-green-500' },
            { label: 'Idle', value: summary.byState.idle ?? 0, color: 'text-yellow-500' },
            { label: 'Terminated', value: summary.byState.terminated ?? 0, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-3 pb-2 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Agent List */}
      <Card>
        <CardHeader>
          <CardTitle>Agents</CardTitle>
          <CardDescription>Click an agent to configure. Use pause/resume to control state.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {summary?.agents.map((agent) => {
              const Icon = AGENT_ICONS[agent.type] ?? Bot;
              const isExpanded = expandedAgent === agent.id;
              const isEditing = editingAgent?.id === agent.id;

              return (
                <div key={agent.id} className="rounded-lg border overflow-hidden">
                  {/* Agent row */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setExpandedAgent(isExpanded ? null : agent.id);
                      if (!isExpanded) setEditingAgent({ ...agent });
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{agent.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{agent.type}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Circle className={`h-1.5 w-1.5 fill-current ${STATE_COLORS[agent.state] ?? ''}`} />
                        <span>{agent.state}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span>{timeAgo(agent.lastHeartbeatAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleToggleState(agent); }}
                        title={agent.state === 'running' ? 'Pause' : 'Resume'}
                      >
                        {agent.state === 'running' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                        onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded config panel */}
                  {isExpanded && isEditing && editingAgent && (
                    <div className="border-t bg-muted/30 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Display Name</Label>
                          <Input
                            value={editingAgent.name}
                            onChange={(e) => setEditingAgent((p: any) => ({ ...p, name: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <select
                            value={editingAgent.type}
                            onChange={(e) => setEditingAgent((p: any) => ({ ...p, type: e.target.value }))}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            {AGENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">State</Label>
                          <select
                            value={editingAgent.state}
                            onChange={(e) => setEditingAgent((p: any) => ({ ...p, state: e.target.value }))}
                            className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="running">Running</option>
                            <option value="idle">Idle</option>
                            <option value="terminated">Terminated</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Version</Label>
                          <Input value={editingAgent.version} disabled className="h-8 text-sm opacity-60" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Capabilities</Label>
                        <div className="flex flex-wrap gap-1">
                          {editingAgent.capabilities?.map((cap: string, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-[10px] font-mono">
                              {cap}
                              <button
                                className="text-muted-foreground hover:text-red-500 text-xs"
                                onClick={() => setEditingAgent((p: any) => ({
                                  ...p,
                                  capabilities: p.capabilities.filter((_: string, idx: number) => idx !== i),
                                }))}
                              >&times;</button>
                            </span>
                          ))}
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 border border-dashed rounded"
                            onClick={() => {
                              const cap = window.prompt('Add capability:');
                              if (cap?.trim()) {
                                setEditingAgent((p: any) => ({ ...p, capabilities: [...(p.capabilities ?? []), cap.trim()] }));
                              }
                            }}
                          >+ add</button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tags</Label>
                        <div className="flex flex-wrap gap-1">
                          {editingAgent.tags?.map((tag: string, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded text-[10px]">
                              {tag}
                              <button
                                className="text-muted-foreground hover:text-red-500 text-xs"
                                onClick={() => setEditingAgent((p: any) => ({
                                  ...p,
                                  tags: p.tags.filter((_: string, idx: number) => idx !== i),
                                }))}
                              >&times;</button>
                            </span>
                          ))}
                          <button
                            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 border border-dashed rounded"
                            onClick={() => {
                              const tag = window.prompt('Add tag:');
                              if (tag?.trim()) {
                                setEditingAgent((p: any) => ({ ...p, tags: [...(p.tags ?? []), tag.trim()] }));
                              }
                            }}
                          >+ add</button>
                        </div>
                      </div>

                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        <div>Registered: {new Date(editingAgent.registeredAt).toLocaleString()}</div>
                        <div>Last heartbeat: {timeAgo(editingAgent.lastHeartbeatAt)}</div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => { setExpandedAgent(null); setEditingAgent(null); }}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveAgent} disabled={saving}>
                          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      {heartbeat && (
        <Card>
          <CardHeader><CardTitle className="text-base">System</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Heartbeat</span>
              <span className="flex items-center gap-1">
                {heartbeat.heartbeat.running ? <Power className="h-3 w-3 text-green-500" /> : <PowerOff className="h-3 w-3 text-red-500" />}
                {heartbeat.heartbeat.running ? 'Active' : 'Stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interval / Timeout</span>
              <span className="font-mono text-xs">{(heartbeat.heartbeat.heartbeatIntervalMs / 1000).toFixed(0)}s / {(heartbeat.heartbeat.heartbeatTimeoutMs / 1000).toFixed(0)}s</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
