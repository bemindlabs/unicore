'use client';

import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';

function DeskScene({ agent }: { agent: BackofficeAgent }) {
  const items = agent.deskItems || [];

  return (
    <div className="flex items-end justify-center gap-2 h-20 relative">
      <div className="flex flex-col items-center gap-1">
        {items.includes('books') && (
          <div className="flex gap-[1px]">
            <div className="w-1.5 h-4 bg-red-700/70 rounded-t-[1px]" />
            <div className="w-1.5 h-5 bg-blue-700/70 rounded-t-[1px]" />
            <div className="w-1.5 h-3.5 bg-green-700/70 rounded-t-[1px]" />
          </div>
        )}
        {items.includes('alert-light') && (
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-red-500/80 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <div className="w-1.5 h-2 bg-[#2a2a3a]" />
          </div>
        )}
        {items.includes('easel') && (
          <div className="flex flex-col items-center">
            <div className="w-6 h-7 bg-white/10 border border-white/20" />
            <div className="w-0.5 h-3 bg-[#5a4a3a]" />
          </div>
        )}
      </div>

      <PixelAvatar color={agent.color} status={agent.status} size="md" />

      <div className="flex flex-col items-center gap-1">
        {items.includes('globe') && (
          <div className="w-4 h-4 rounded-full bg-blue-600/40 border border-blue-400/30" />
        )}
        {items.includes('palette') && (
          <div className="w-5 h-4 rounded-full bg-[#8b6914]/60 relative">
            {['#ef5350', '#4fc3f7', '#ffb74d', '#81c784'].map((c, i) => (
              <div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                style={{ background: c, left: `${20 + i * 18}%`, top: `${30 + (i % 2) * 25}%` }} />
            ))}
          </div>
        )}
        {items.includes('galaxy-screen') && (
          <div className="w-8 h-5 bg-[#0a0628] border border-purple-900/50 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-purple-900/40 via-transparent to-blue-900/40 relative">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="absolute w-0.5 h-0.5 bg-white rounded-full"
                  style={{ left: `${15 + i * 18}%`, top: `${20 + ((i * 37) % 60)}%` }} />
              ))}
            </div>
          </div>
        )}
        {items.includes('headset') && (
          <div className="flex flex-col items-center">
            <div className="w-4 h-2 border-t-2 border-l-2 border-r-2 border-cyan-400/40 rounded-t-full" />
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-400/30 rounded-full" />
              <div className="w-1.5 h-1.5 bg-cyan-400/30 rounded-full" />
            </div>
          </div>
        )}
        {items.includes('charts') && (
          <div className="w-8 h-5 bg-[#0a1628] border border-[#1a3a5a] p-0.5 flex items-end gap-[2px]">
            {[3, 5, 2, 6, 4].map((h, i) => (
              <div key={i} className="w-1 bg-green-400/50 rounded-t-[1px]" style={{ height: h * 1.2 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkstationCard({ agent, onClick }: { agent: BackofficeAgent; onClick: () => void }) {
  const { isActive: isRetroDesk } = useRetroDeskTheme();

  return (
    <button
      onClick={onClick}
      className={isRetroDesk
        ? 'border-2 overflow-hidden hover:shadow-md transition-all group text-left w-full'
        : 'border border-[var(--bo-border)] bg-[var(--bo-bg-raised)] overflow-hidden hover:border-[var(--bo-border-accent)] hover:shadow-[var(--bo-glow)] transition-all group text-left w-full'}
      style={isRetroDesk ? { borderColor: 'var(--retrodesk-border)', background: 'var(--retrodesk-surface)' } : undefined}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b ${
          isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border-subtle)]'
        }`}
      >
        <span
          className={isRetroDesk
            ? 'retrodesk-mono text-sm tracking-wider uppercase'
            : 'font-mono text-[10px] text-[var(--bo-text-accent)] tracking-wider uppercase'}
          style={isRetroDesk ? { color: 'var(--retrodesk-text)' } : undefined}
        >
          {agent.name}
        </span>
        <StatusIndicator status={agent.status} />
      </div>
      <div className="px-3 py-3">
        <DeskScene agent={agent} />
        <div className="flex flex-col items-center mt-1">
          <div
            className="w-full h-1.5 rounded-t-sm"
            style={{
              background: isRetroDesk
                ? 'linear-gradient(to right, #d4a76a, #e8c89a, #d4a76a)'
                : 'linear-gradient(to right, #3a2a1a, #4a3a2a, #3a2a1a)',
            }}
          />
          <div className="flex justify-between w-3/4">
            <div className="w-1.5 h-3" style={{ background: isRetroDesk ? '#d4a76a' : '#3a2a1a' }} />
            <div className="w-1.5 h-3" style={{ background: isRetroDesk ? '#d4a76a' : '#3a2a1a' }} />
          </div>
        </div>
      </div>
      {agent.activity && (
        <div className="px-3 pb-2">
          <p
            className={isRetroDesk
              ? 'retrodesk-mono text-xs truncate'
              : 'text-[10px] font-mono text-[var(--bo-text-dim)] truncate'}
            style={isRetroDesk ? { color: 'var(--retrodesk-muted)' } : undefined}
          >
            {'> '}{agent.activity}
          </p>
        </div>
      )}
    </button>
  );
}
