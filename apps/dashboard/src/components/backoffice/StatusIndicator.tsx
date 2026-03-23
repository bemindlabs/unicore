'use client';

import type { AgentStatus } from '@/lib/backoffice/types';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';

const config: Record<AgentStatus, { color: string; glow: string; label: string }> = {
  working: { color: 'bg-green-400', glow: 'shadow-[0_0_6px_rgba(74,222,128,0.6)]', label: 'WORKING' },
  idle: { color: 'bg-yellow-400', glow: '', label: 'IDLE' },
  offline: { color: 'bg-red-500', glow: '', label: 'OFFLINE' },
};

const retrodeskConfig: Record<AgentStatus, { color: string; label: string; icon: string }> = {
  working: { color: '#a8e6cf', label: 'WORKING', icon: '♥' },
  idle: { color: '#ffd93d', label: 'IDLE', icon: '★' },
  offline: { color: '#e5e1dc', label: 'OFFLINE', icon: '☁' },
};

export function StatusIndicator({ status, showLabel = false }: { status: AgentStatus; showLabel?: boolean }): JSX.Element {
  const { isActive: isRetroDesk } = useRetroDeskTheme();

  if (isRetroDesk) {
    const cc = retrodeskConfig[status];
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="retrodesk-mono text-sm" style={{ color: cc.color }}>{cc.icon}</span>
        {showLabel && (
          <span className="retrodesk-mono text-sm tracking-wider uppercase" style={{ color: cc.color }}>
            {cc.label}
          </span>
        )}
      </span>
    );
  }

  const c = config[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.color} ${c.glow} ${status === 'working' ? 'animate-pulse' : ''}`} />
      {showLabel && (
        <span className={`font-mono text-[9px] tracking-wider uppercase ${
          status === 'working' ? 'text-green-400' : status === 'idle' ? 'text-yellow-400' : 'text-red-400'
        }`}>
          [{c.label}]
        </span>
      )}
    </span>
  );
}
