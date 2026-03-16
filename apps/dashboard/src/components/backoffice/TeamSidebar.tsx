'use client';

import dynamic from 'next/dynamic';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';
import { useChinjanTheme, ChinjanOnly } from './chinjan/ChinjanThemeProvider';

const ChinjanEmptyState = dynamic(
  () => import('./chinjan/ChinjanEmptyState').then((m) => m.ChinjanEmptyState),
  { ssr: false }
);

interface Props {
  agents: BackofficeAgent[];
  filter: 'all' | 'working' | 'idle';
  onFilterChange: (filter: 'all' | 'working' | 'idle') => void;
  onSelectAgent: (agent: BackofficeAgent) => void;
  onOpenTerminal?: (agent: BackofficeAgent) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function TeamSidebar({ agents, filter, onFilterChange, onSelectAgent, onOpenTerminal, mobileOpen, onCloseMobile }: Props) {
  const filters: { key: 'all' | 'working' | 'idle'; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'working', label: 'WORKING' },
    { key: 'idle', label: 'IDLE' },
  ];

  const { isActive: isChinjan } = useChinjanTheme();

  return (
    <aside
      className={`w-64 border-r flex-shrink-0 flex-col transition-transform duration-200 ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 flex'
          : 'hidden md:flex'
      } ${
        isChinjan ? 'border-[var(--chinjan-border)]' : 'border-cyan-900/30 bg-[#0a0e1a]/60'
      }`}
      style={isChinjan ? { background: 'var(--chinjan-surface)', borderColor: 'var(--chinjan-border)' } : !isChinjan && mobileOpen ? { background: '#0a0e1a' } : undefined}
    >
      <div className={`px-4 py-3 border-b ${isChinjan ? 'border-[var(--chinjan-border)]' : 'border-cyan-900/20'}`}>
        <h2
          className={isChinjan
            ? 'chinjan-heading text-[8px] tracking-widest uppercase'
            : 'font-mono text-[10px] text-cyan-500/70 tracking-widest uppercase'}
          style={isChinjan ? { color: 'var(--chinjan-pink)' } : undefined}
        >
          Team Status Overview
        </h2>
      </div>

      <div className={`flex gap-1 px-3 py-2 border-b ${isChinjan ? 'border-[var(--chinjan-border)]' : 'border-cyan-900/20'}`}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={isChinjan
              ? `chinjan-mono text-sm px-2 py-1 transition-all tracking-wider border-2 ${
                  filter === f.key
                    ? 'border-[var(--chinjan-pink)] text-[var(--chinjan-pink)]'
                    : 'border-transparent text-[var(--chinjan-muted)] hover:text-[var(--chinjan-text)]'
                }`
              : `font-mono text-[9px] px-2 py-1 transition-all tracking-wider ${
                  filter === f.key
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-cyan-600/40 hover:text-cyan-400/60 border border-transparent'
                }`
            }
            style={isChinjan && filter === f.key ? { background: 'color-mix(in srgb, var(--chinjan-pink) 10%, transparent)' } : undefined}
          >
            {isChinjan ? f.label : `[${f.label}]`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${
              isChinjan
                ? 'hover:bg-[color-mix(in_srgb,var(--chinjan-pink)_5%,transparent)]'
                : 'hover:bg-cyan-500/5'
            }`}
          >
            <PixelAvatar color={agent.color} status={agent.status} size="sm" />
            <div className="flex-1 min-w-0">
              <div
                className={isChinjan
                  ? 'chinjan-mono text-sm truncate uppercase tracking-wider'
                  : 'font-mono text-[10px] text-cyan-300 group-hover:text-cyan-200 truncate uppercase tracking-wider'}
                style={isChinjan ? { color: 'var(--chinjan-text)' } : undefined}
              >
                {agent.name}
              </div>
              <StatusIndicator status={agent.status} showLabel />
            </div>
            <StatusIndicator status={agent.status} />
            {onOpenTerminal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTerminal(agent);
                }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[9px] px-1.5 py-0.5 ${
                  isChinjan
                    ? 'text-[var(--chinjan-muted)] hover:text-[var(--chinjan-pink)] border border-[var(--chinjan-border)]'
                    : 'text-green-600/50 hover:text-green-400 border border-green-900/30 hover:border-green-500/40'
                }`}
                title={`Open terminal for ${agent.name}`}
              >
                {'>_'}
              </button>
            )}
          </button>
        ))}
        {agents.length === 0 && (
          <>
            <ChinjanOnly>
              <ChinjanEmptyState message="No agents found" />
            </ChinjanOnly>
            {!isChinjan && (
              <p className="text-center text-cyan-600/30 font-mono text-[9px] py-8 uppercase">
                No agents found
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
