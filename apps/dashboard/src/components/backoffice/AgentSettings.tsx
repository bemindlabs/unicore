'use client';

import { useState, useEffect, useCallback } from 'react';

interface OpenClawAgent {
  name: string;
  type: string;
  state: string;
  capabilities: string[];
}

export function AgentSettings() {
  const [agents, setAgents] = useState<OpenClawAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/openclaw/health/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : data.agents ?? []);
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

  const stateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
      case 'active':
        return 'text-green-400 bg-green-500/10';
      case 'idle':
      case 'waiting':
        return 'text-yellow-400 bg-yellow-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs text-cyan-400 uppercase tracking-wider">
          OpenClaw Gateway Agents
        </h3>
        <button
          onClick={fetchAgents}
          disabled={loading}
          className="font-mono text-[9px] text-cyan-500 hover:text-cyan-300 disabled:text-cyan-800 border border-cyan-500/30 hover:border-cyan-400/50 disabled:border-cyan-900/30 px-3 py-1.5 transition-all uppercase tracking-wider"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="font-mono text-[10px] text-red-400/80 bg-red-500/10 border border-red-500/20 px-3 py-2">
          Error: {error}
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <div className="font-mono text-[10px] text-cyan-600/40 text-center py-8 uppercase tracking-wider">
          No agents registered
        </div>
      )}

      <div className="space-y-2">
        {agents.map((agent, i) => (
          <div
            key={`${agent.name}-${i}`}
            className="border border-cyan-900/30 bg-[#0a0e1a]/60 px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-cyan-300 uppercase tracking-wider">
                {agent.name}
              </span>
              <span
                className={`font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider ${stateColor(agent.state)}`}
              >
                {agent.state}
              </span>
            </div>
            <div className="font-mono text-[9px] text-cyan-600/50 space-y-1">
              <div>Type: {agent.type}</div>
              {agent.capabilities && agent.capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {agent.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-500/70 border border-cyan-900/30 text-[8px] uppercase"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
