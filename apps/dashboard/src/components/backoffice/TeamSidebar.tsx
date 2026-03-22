'use client';

import dynamic from 'next/dynamic';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';
import { useRetroDeskTheme, RetroDeskOnly } from './retrodesk/RetroDeskThemeProvider';

const RetroDeskEmptyState = dynamic(
  () => import('./retrodesk/RetroDeskEmptyState').then((m) => m.RetroDeskEmptyState),
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

export function TeamSidebar({ agents, filter, onFilterChange, onSelectAgent, onOpenTerminal, mobileOpen }: Props) {
  const filters: { key: 'all' | 'working' | 'idle'; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'working', label: 'WORKING' },
    { key: 'idle', label: 'IDLE' },
  ];

  const { isActive: isRetroDesk } = useRetroDeskTheme();

  return (
    <aside
      className={`w-64 border-r flex-shrink-0 flex-col transition-transform duration-200 ${
        mobileOpen
          ? 'fixed inset-y-0 left-0 z-50 flex'
          : 'hidden md:flex'
      } ${
        isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)] bg-[var(--bo-bg)]'
      }`}
      style={isRetroDesk ? { background: 'var(--retrodesk-surface)', borderColor: 'var(--retrodesk-border)' } : !isRetroDesk && mobileOpen ? { background: 'var(--bo-bg)' } : undefined}
    >
      <div className={`px-4 py-3 border-b ${isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border-subtle)]'}`}>
        <h2
          className={isRetroDesk
            ? 'retrodesk-heading text-[8px] tracking-widest uppercase'
            : 'font-mono text-[10px] text-[var(--bo-text-info)] tracking-widest uppercase'}
          style={isRetroDesk ? { color: 'var(--retrodesk-pink)' } : undefined}
        >
          Team Status Overview
        </h2>
      </div>

      <div className={`flex gap-1 px-3 py-2 border-b ${isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border-subtle)]'}`}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={isRetroDesk
              ? `retrodesk-mono text-sm px-2 py-1 transition-all tracking-wider border-2 ${
                  filter === f.key
                    ? 'border-[var(--retrodesk-pink)] text-[var(--retrodesk-pink)]'
                    : 'border-transparent text-[var(--retrodesk-muted)] hover:text-[var(--retrodesk-text)]'
                }`
              : `font-mono text-[9px] px-2 py-1 transition-all tracking-wider ${
                  filter === f.key
                    ? 'bg-[var(--bo-accent-20)] text-[var(--bo-text-accent-2)] border border-[var(--bo-border-accent)]'
                    : 'text-[var(--bo-text-dim)] hover:text-[var(--bo-text-accent)] border border-transparent'
                }`
            }
            style={isRetroDesk && filter === f.key ? { background: 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' } : undefined}
          >
            {isRetroDesk ? f.label : `[${f.label}]`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {agents.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left group ${
              isRetroDesk
                ? 'hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_5%,transparent)]'
                : 'hover:bg-[var(--bo-accent-5)]'
            }`}
          >
            {isRetroDesk ? (
              <div className="relative flex-shrink-0 z-10 w-8 h-8 flex items-center justify-center translate-y-2">
                <PixelAvatar color={agent.color} status={agent.status} size="md" name={agent.name} forceStyle={agent.styleId} className="-translate-y-3" />
              </div>
            ) : (
              <PixelAvatar color={agent.color} status={agent.status} size="sm" forceStyle={agent.styleId} />
            )}
            <div className="flex-1 min-w-0">
              <div
                className={isRetroDesk
                  ? 'retrodesk-mono text-sm truncate uppercase tracking-wider'
                  : 'font-mono text-[10px] text-[var(--bo-text-accent-2)] group-hover:text-[var(--bo-text-accent)] truncate uppercase tracking-wider'}
                style={isRetroDesk ? { color: 'var(--retrodesk-text)' } : undefined}
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
                  isRetroDesk
                    ? 'text-[var(--retrodesk-muted)] hover:text-[var(--retrodesk-pink)] border border-[var(--retrodesk-border)]'
                    : 'text-green-600/50 hover:text-green-400 border border-green-900/30 hover:border-green-500/40'
                }`}
                title="Open terminal"
                aria-label="Open terminal"
              >
                {'>_'}
              </button>
            )}
          </button>
        ))}
        {agents.length === 0 && (
          <>
            <RetroDeskOnly>
              <RetroDeskEmptyState message="No agents found" />
            </RetroDeskOnly>
            {!isRetroDesk && (
              <p className="text-center text-[var(--bo-text-dimmer)] font-mono text-[9px] py-8 uppercase">
                No agents found
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
