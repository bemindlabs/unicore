'use client';

import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';

interface Props {
  agents: BackofficeAgent[];
  filter: 'all' | 'working' | 'idle';
  onFilterChange: (filter: 'all' | 'working' | 'idle') => void;
  onSelectAgent: (agent: BackofficeAgent) => void;
}

export function TeamSidebar({ agents, filter, onFilterChange, onSelectAgent }: Props) {
  const filters: { key: 'all' | 'working' | 'idle'; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'working', label: 'WORKING' },
    { key: 'idle', label: 'IDLE' },
  ];

  return (
    <aside className="w-56 lg:w-64 border-r border-cyan-900/30 bg-[#0a0e1a]/60 flex-shrink-0 hidden md:flex flex-col">
      <div className="px-4 py-3 border-b border-cyan-900/20">
        <h2 className="font-mono text-[10px] text-cyan-500/70 tracking-widest uppercase">
          Team Status Overview
        </h2>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-cyan-900/20">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`font-mono text-[9px] px-2 py-1 transition-all tracking-wider ${
              filter === f.key
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-cyan-600/40 hover:text-cyan-400/60 border border-transparent'
            }`}
          >
            [{f.label}]
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-500/5 transition-colors text-left group"
          >
            <PixelAvatar color={agent.color} status={agent.status} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] text-cyan-300 group-hover:text-cyan-200 truncate uppercase tracking-wider">
                {agent.name}
              </div>
              <StatusIndicator status={agent.status} showLabel />
            </div>
            <StatusIndicator status={agent.status} />
          </button>
        ))}
        {agents.length === 0 && (
          <p className="text-center text-cyan-600/30 font-mono text-[9px] py-8 uppercase">
            No agents found
          </p>
        )}
      </div>
    </aside>
  );
}
