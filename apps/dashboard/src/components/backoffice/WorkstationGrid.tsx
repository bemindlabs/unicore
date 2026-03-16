'use client';

import type { BackofficeAgent } from '@/lib/backoffice/types';
import { WorkstationCard } from './WorkstationCard';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';

interface Props {
  agents: BackofficeAgent[];
  onSelectAgent: (agent: BackofficeAgent) => void;
}

export function WorkstationGrid({ agents, onSelectAgent }: Props) {
  const { isActive: isRetroDesk } = useRetroDeskTheme();

  if (agents.length === 0) return null;

  return (
    <div>
      <h3
        className={isRetroDesk
          ? 'retrodesk-heading text-[8px] tracking-widest mb-3 px-1 uppercase'
          : 'font-mono text-[10px] text-cyan-600/50 tracking-widest mb-3 px-1 uppercase'}
        style={isRetroDesk ? { color: 'var(--retrodesk-blue)' } : undefined}
      >
        Workstations
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {agents.map(agent => (
          <WorkstationCard key={agent.id} agent={agent} onClick={() => onSelectAgent(agent)} />
        ))}
      </div>
    </div>
  );
}
