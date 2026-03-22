'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';

type AutonomyLevel = 'suggest' | 'approval' | 'full-auto';

const CHANNELS = ['web', 'email', 'slack', 'line', 'telegram', 'whatsapp'] as const;
type Channel = (typeof CHANNELS)[number];

const CAPABILITY_COLORS: Record<string, string> = {
  routing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  messaging: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  analytics: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  finance: 'bg-green-500/20 text-green-400 border-green-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  marketing: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  integration: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  research: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  building: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

function capabilityColor(cap: string): string {
  const key = Object.keys(CAPABILITY_COLORS).find((k) =>
    cap.toLowerCase().includes(k),
  );
  return key
    ? CAPABILITY_COLORS[key]
    : 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

interface OpenClawAgent {
  name: string;
  type: string;
  state: string;
  capabilities: string[];
  lastHeartbeat?: string;
  messagesCount?: number;
}

interface AgentConfig {
  name: string;
  role: string;
  status: 'working' | 'idle' | 'offline';
  autonomy: AutonomyLevel;
  channels: Channel[];
}

function uptimeLabel(lastHeartbeat?: string): string {
  if (!lastHeartbeat) return 'N/A';
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function AgentSettings() {
  const { isActive: isRetroDesk } = useRetroDeskTheme();
  const [agents, setAgents] = useState<OpenClawAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [configs, setConfigs] = useState<Record<number, AgentConfig>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<number, boolean>>({});

  // Map Directives state
  const [autonomyEnabled, setAutonomyEnabled] = useState(false);
  const [autonomyInterval, setAutonomyInterval] = useState(30);
  const [directivesSaving, setDirectivesSaving] = useState(false);
  const [directivesSaved, setDirectivesSaved] = useState(false);

  // Load Map Directives on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<any>('/api/v1/settings/map-directives');
        if (data) {
          if (typeof data.autonomyEnabled === 'boolean') setAutonomyEnabled(data.autonomyEnabled);
          if (typeof data.autonomyInterval === 'number') setAutonomyInterval(data.autonomyInterval);
        }
      } catch {
        // Settings may not exist yet, use defaults
      }
    })();
  }, []);

  // Save Map Directives
  async function saveDirectives() {
    setDirectivesSaving(true);
    setDirectivesSaved(false);
    try {
      await api.put('/api/v1/settings/map-directives', {
        autonomyEnabled,
        autonomyInterval,
      });
      setDirectivesSaved(true);
      setTimeout(() => setDirectivesSaved(false), 2000);
    } catch {
      // Save failed silently
    } finally {
      setDirectivesSaving(false);
    }
  }

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<any>('/api/proxy/openclaw/health/agents');
      const list: OpenClawAgent[] = Array.isArray(data) ? data : data.agents ?? [];
      setAgents(list);
      // Initialize configs from agent data
      const newConfigs: Record<number, AgentConfig> = {};
      list.forEach((agent, i) => {
        newConfigs[i] = {
          name: agent.name,
          role: agent.type,
          status: mapStatus(agent.state),
          autonomy: 'suggest',
          channels: [],
        };
      });
      setConfigs(newConfigs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  function mapStatus(state: string): 'working' | 'idle' | 'offline' {
    const s = state.toLowerCase();
    if (s === 'running' || s === 'active' || s === 'working') return 'working';
    if (s === 'stopped' || s === 'error' || s === 'offline') return 'offline';
    return 'idle';
  }

  const stateColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/30';
      case 'idle':
        return 'text-amber-600 dark:text-yellow-400 bg-amber-100 dark:bg-yellow-500/10 border-amber-200 dark:border-yellow-500/30';
      case 'offline':
        return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/30';
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/30';
    }
  };

  function updateConfig(index: number, partial: Partial<AgentConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [index]: { ...prev[index], ...partial },
    }));
    // Clear any previous save success indicator on change
    setSaveSuccess((prev) => ({ ...prev, [index]: false }));
  }

  function toggleChannel(index: number, channel: Channel) {
    const current = configs[index]?.channels ?? [];
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    updateConfig(index, { channels: next });
  }

  async function saveAgent(index: number) {
    const config = configs[index];
    if (!config) return;
    const agent = agents[index];
    if (!agent) return;

    setSaving((prev) => ({ ...prev, [index]: true }));
    setSaveSuccess((prev) => ({ ...prev, [index]: false }));
    try {
      await api.put(`/api/v1/settings/agent-config-${agent.name}`, {
        autonomy: config.autonomy,
        name: config.name,
        role: config.role,
        status: config.status,
        channels: config.channels,
      });
      setSaveSuccess((prev) => ({ ...prev, [index]: true }));
      // Clear success after 2 seconds
      setTimeout(() => {
        setSaveSuccess((prev) => ({ ...prev, [index]: false }));
      }, 2000);
    } catch {
      // Save failed silently - could add error state per agent
    } finally {
      setSaving((prev) => ({ ...prev, [index]: false }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Map Directives */}
      <div className={`border p-4 space-y-4 ${
        isRetroDesk
          ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-surface)]'
          : 'border-[var(--bo-border)] bg-[var(--bo-bg)]'
      }`}>
        <h3 className={`text-xs uppercase tracking-wider ${
          isRetroDesk ? 'retrodesk-heading text-[var(--retrodesk-pink)]' : 'font-mono text-[var(--bo-text-accent)]'
        }`}>
          Map Directives
        </h3>

        {/* LLM Spatial Autonomy toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <label className={`text-[10px] uppercase tracking-wider font-bold ${
              isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'font-mono text-[var(--bo-text-accent-2)]'
            }`}>
              LLM Spatial Autonomy
            </label>
            <span className={`text-[8px] ${
              isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-muted)]' : 'font-mono text-[var(--bo-text-muted)]'
            }`}>
              Allow OpenClaw AI to drive characters.
            </span>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autonomyEnabled}
              onChange={(e) => { setAutonomyEnabled(e.target.checked); setDirectivesSaved(false); }}
              className="w-4 h-4 cursor-pointer accent-blue-500"
            />
          </label>
        </div>

        {/* Think Interval slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={`text-[10px] uppercase tracking-wider font-bold ${
              isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'font-mono text-[var(--bo-text-accent-2)]'
            }`}>
              Think Interval (Sec)
            </label>
            <span className={`text-[10px] font-bold ${
              isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'font-mono text-[var(--bo-text-accent-2)]'
            }`}>
              {autonomyInterval}s
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={10}
            value={autonomyInterval}
            onChange={(e) => { setAutonomyInterval(Number(e.target.value)); setDirectivesSaved(false); }}
            className="w-full cursor-pointer"
            disabled={!autonomyEnabled}
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-2">
          {directivesSaved && (
            <span className="font-mono text-[9px] text-green-400 uppercase tracking-wider">
              Saved
            </span>
          )}
          <button
            onClick={saveDirectives}
            disabled={directivesSaving}
            className="font-mono text-[9px] text-[var(--bo-text-accent-2)] hover:text-[var(--bo-text-bright)] disabled:text-[var(--bo-text-dimmer)] bg-[var(--bo-accent-10)] hover:bg-[var(--bo-accent-20)] disabled:bg-[var(--bo-accent-5)] border border-[var(--bo-border-accent)] hover:border-[var(--bo-border-accent-hover)] disabled:border-[var(--bo-border)] px-4 py-1.5 transition-all uppercase tracking-wider"
          >
            {directivesSaving ? 'Saving...' : 'Save Directives'}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-xs uppercase tracking-wider ${
          isRetroDesk ? 'retrodesk-heading text-[var(--retrodesk-pink)]' : 'font-mono text-[var(--bo-text-accent)]'
        }`}>
          OpenClaw Gateway Agents
        </h3>
        <button
          onClick={fetchAgents}
          disabled={loading}
          className={`text-[9px] px-3 py-1.5 transition-all uppercase tracking-wider border ${
            isRetroDesk
              ? 'retrodesk-mono text-[var(--retrodesk-text)] hover:text-[var(--retrodesk-pink)] border-[var(--retrodesk-border)] hover:border-[var(--retrodesk-pink)] disabled:text-[var(--retrodesk-muted)] disabled:border-[var(--retrodesk-border)]'
              : 'font-mono text-[var(--bo-text-info)] hover:text-[var(--bo-text-accent-2)] disabled:text-[var(--bo-text-dimmer)] border-[var(--bo-border-accent)] hover:border-[var(--bo-border-accent-hover)] disabled:border-[var(--bo-border)]'
          }`}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="font-mono text-[10px] text-red-700 bg-red-100 border-red-200 dark:text-red-400/80 dark:bg-red-500/10 border dark:border-red-500/20 px-3 py-2">
          Error: {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && (
        <div className={`text-[10px] text-center py-8 uppercase tracking-wider ${
          isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-muted)]' : 'font-mono text-[var(--bo-text-dim)]'
        }`}>
          No agents registered
        </div>
      )}

      {/* Agent cards */}
      <div className="space-y-2">
        {agents.map((agent, i) => {
          const isExpanded = expandedIndex === i;
          const config = configs[i];
          const isSaving = saving[i] ?? false;
          const isSaved = saveSuccess[i] ?? false;

          return (
            <div
              key={`${agent.name}-${i}`}
              className={`border overflow-hidden transition-all ${
                isRetroDesk
                  ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-surface)]'
                  : 'border-[var(--bo-border)] bg-[var(--bo-bg)]'
              }`}
            >
              {/* Collapsed row - always visible */}
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className={`w-full px-4 py-3 flex items-center justify-between transition-colors text-left ${
                  isRetroDesk
                    ? 'hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_5%,transparent)]'
                    : 'hover:bg-[var(--bo-accent-5)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs uppercase tracking-wider truncate ${
                    isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'font-mono text-[var(--bo-text-accent-2)]'
                  }`}>
                    {agent.name}
                  </span>
                  <span className={`text-[9px] ${
                    isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-muted)]' : 'font-mono text-[var(--bo-text-muted)]'
                  }`}>
                    {agent.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Health: uptime badge */}
                  <span className="font-mono text-[9px] text-[var(--bo-text-muted)] bg-[var(--bo-accent-5)] border border-[var(--bo-border-subtle)] px-1.5 py-0.5">
                    up {uptimeLabel(agent.lastHeartbeat)}
                  </span>
                  {/* Messages count */}
                  <span className="font-mono text-[9px] text-[var(--bo-text-muted)] bg-[var(--bo-accent-5)] border border-[var(--bo-border-subtle)] px-1.5 py-0.5">
                    {agent.messagesCount ?? 0} msgs
                  </span>
                  {/* Status badge */}
                  <span
                    className={`font-mono text-[9px] px-2 py-0.5 border rounded uppercase tracking-wider ${stateColor(config?.status ?? mapStatus(agent.state))}`}
                  >
                    {config?.status ?? mapStatus(agent.state)}
                  </span>
                  {/* Expand indicator */}
                  <svg
                    className={`w-3.5 h-3.5 text-[var(--bo-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded panel */}
              {isExpanded && config && (
                <div className="border-t border-[var(--bo-border-subtle)] px-4 py-4 space-y-4">
                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                        Capabilities
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {agent.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className={`px-2 py-0.5 border text-[9px] font-mono uppercase tracking-wider rounded-sm ${capabilityColor(cap)}`}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Separator */}
                  <div className="border-t border-[var(--bo-border-subtle)]" />

                  {/* Edit fields: Name, Role, Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                        Name
                      </label>
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => updateConfig(i, { name: e.target.value })}
                        className="w-full font-mono text-[10px] text-[var(--bo-text-accent-2)] bg-[var(--bo-bg-input)] border border-[var(--bo-border)] px-2 py-1.5 focus:outline-none focus:border-[var(--bo-border-accent-hover)] transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                        Role
                      </label>
                      <input
                        type="text"
                        value={config.role}
                        onChange={(e) => updateConfig(i, { role: e.target.value })}
                        className="w-full font-mono text-[10px] text-[var(--bo-text-accent-2)] bg-[var(--bo-bg-input)] border border-[var(--bo-border)] px-2 py-1.5 focus:outline-none focus:border-[var(--bo-border-accent-hover)] transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                        Status
                      </label>
                      <select
                        value={config.status}
                        onChange={(e) =>
                          updateConfig(i, {
                            status: e.target.value as 'working' | 'idle' | 'offline',
                          })
                        }
                        className="w-full font-mono text-[10px] text-[var(--bo-text-accent-2)] bg-[var(--bo-bg-input)] border border-[var(--bo-border)] px-2 py-1.5 focus:outline-none focus:border-[var(--bo-border-accent-hover)] transition-colors appearance-none cursor-pointer"
                      >
                        <option value="working">Working</option>
                        <option value="idle">Idle</option>
                        <option value="offline">Offline</option>
                      </select>
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-[var(--bo-border-subtle)]" />

                  {/* Autonomy Level */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                      Autonomy Level
                    </label>
                    <select
                      value={config.autonomy}
                      onChange={(e) =>
                        updateConfig(i, { autonomy: e.target.value as AutonomyLevel })
                      }
                      className="w-full font-mono text-[10px] text-[var(--bo-text-accent-2)] bg-[var(--bo-bg-input)] border border-[var(--bo-border)] px-2 py-1.5 focus:outline-none focus:border-[var(--bo-border-accent-hover)] transition-colors appearance-none cursor-pointer"
                    >
                      <option value="suggest">Suggest</option>
                      <option value="approval">Approval</option>
                      <option value="full-auto">Full Auto</option>
                    </select>
                  </div>

                  {/* Channel Assignment */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-[9px] text-[var(--bo-text-muted)] uppercase tracking-wider">
                      Channel Assignment
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNELS.map((ch) => {
                        const active = config.channels.includes(ch);
                        return (
                          <label
                            key={ch}
                            className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider px-2 py-1 border cursor-pointer transition-colors ${
                              active
                                ? 'border-[var(--bo-border-accent-hover)] text-[var(--bo-text-accent-2)] bg-[var(--bo-accent-10)]'
                                : 'border-[var(--bo-border)] text-[var(--bo-text-dim)] bg-transparent hover:border-[var(--bo-border-strong)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleChannel(i, ch)}
                              className="sr-only"
                            />
                            <span
                              className={`w-2.5 h-2.5 border flex items-center justify-center ${
                                active
                                  ? 'border-[var(--bo-text-accent)] bg-[var(--bo-accent-30)]'
                                  : 'border-[var(--bo-border-strong)]'
                              }`}
                            >
                              {active && (
                                <svg className="w-1.5 h-1.5 text-[var(--bo-text-accent-2)]" viewBox="0 0 12 12" fill="currentColor">
                                  <path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" />
                                </svg>
                              )}
                            </span>
                            {ch}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-[var(--bo-border-subtle)]" />

                  {/* Save button */}
                  <div className="flex items-center justify-end gap-2">
                    {isSaved && (
                      <span className="font-mono text-[9px] text-green-400 uppercase tracking-wider">
                        Saved
                      </span>
                    )}
                    <button
                      onClick={() => saveAgent(i)}
                      disabled={isSaving}
                      className="font-mono text-[9px] text-[var(--bo-text-accent-2)] hover:text-[var(--bo-text-bright)] disabled:text-[var(--bo-text-dimmer)] bg-[var(--bo-accent-10)] hover:bg-[var(--bo-accent-20)] disabled:bg-[var(--bo-accent-5)] border border-[var(--bo-border-accent)] hover:border-[var(--bo-border-accent-hover)] disabled:border-[var(--bo-border)] px-4 py-1.5 transition-all uppercase tracking-wider"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
