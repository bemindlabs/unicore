'use client';

import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';
import { useChinjanTheme, ChinjanOnly, DefaultOnly } from './chinjan/ChinjanThemeProvider';

interface Props {
  conferenceAgents: BackofficeAgent[];
  mainOfficeAgents: BackofficeAgent[];
  onSelectAgent: (agent: BackofficeAgent) => void;
}

function RoomPanel({ title, children }: { title: string; children: React.ReactNode }) {
  const { isActive: isChinjan } = useChinjanTheme();
  return (
    <div
      className={isChinjan
        ? 'border-2 overflow-hidden'
        : 'border border-cyan-900/40 bg-[#0b1120]/80 overflow-hidden'}
      style={isChinjan ? { borderColor: 'var(--chinjan-border)', background: 'var(--chinjan-surface)' } : undefined}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b ${
          isChinjan ? 'border-[var(--chinjan-border)]' : 'border-cyan-900/30'
        }`}
      >
        <span
          className={isChinjan
            ? 'chinjan-heading text-[8px] tracking-wider uppercase'
            : 'font-mono text-[10px] text-cyan-500/80 tracking-wider uppercase'}
          style={isChinjan ? { color: 'var(--chinjan-blue)' } : undefined}
        >
          {title}
        </span>
        <StatusIndicator status="working" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PixelDesk({ variant = 'standard' }: { variant?: 'standard' | 'command' | 'round-table' }) {
  const { isActive: isChinjan } = useChinjanTheme();

  if (variant === 'round-table') {
    return (
      <div className="relative mx-auto" style={{ width: 160, height: 80 }}>
        <div
          className="absolute inset-0 rounded-[50%] border-2"
          style={{
            borderColor: isChinjan ? 'var(--chinjan-border)' : '#5a4a3a',
            background: isChinjan
              ? 'linear-gradient(135deg, var(--chinjan-yellow), #ffe8a3)'
              : 'linear-gradient(135deg, #4a3a2a, #3a2a1a)',
          }}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <div
            key={angle}
            className="absolute w-3 h-3 border"
            style={{
              background: isChinjan ? 'var(--chinjan-surface)' : '#2a2a3a',
              borderColor: isChinjan ? 'var(--chinjan-border)' : '#3a3a4a',
              left: `${50 + 48 * Math.cos((angle * Math.PI) / 180)}%`,
              top: `${50 + 42 * Math.sin((angle * Math.PI) / 180)}%`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'command') {
    return (
      <div className="flex items-end gap-1 justify-center">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="w-10 h-7 border relative overflow-hidden"
              style={{
                background: isChinjan ? 'var(--chinjan-surface)' : '#0a1628',
                borderColor: isChinjan ? 'var(--chinjan-border)' : '#1a3a5a',
              }}
            >
              <div className="absolute inset-0.5 opacity-60">
                {[0, 1, 2, 3].map(line => (
                  <div
                    key={line}
                    className="h-[2px] mb-[2px] rounded-full"
                    style={{
                      width: `${40 + Math.random() * 50}%`,
                      background: isChinjan
                        ? (i === 0 ? 'var(--chinjan-pink)' : i === 1 ? 'var(--chinjan-blue)' : 'var(--chinjan-yellow)')
                        : (i === 0 ? '#00ff88' : i === 1 ? '#00e5ff' : '#4fc3f7'),
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="w-2 h-1" style={{ background: isChinjan ? 'var(--chinjan-border)' : '#2a2a3a' }} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function PixelPlant() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-3 h-3 rounded-full bg-green-700/80" />
      <div className="w-1 h-2 bg-green-800" />
      <div className="w-3 h-2 bg-[#8b6914] rounded-t-sm" />
    </div>
  );
}

/** Chinjan-style pixel flower (replaces plant) */
function PixelFlowerDeco() {
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-[1px]">
        <div className="w-2 h-2" style={{ background: 'var(--chinjan-pink)' }} />
        <div className="w-2 h-2" style={{ background: 'var(--chinjan-yellow)' }} />
        <div className="w-2 h-2" style={{ background: 'var(--chinjan-pink)' }} />
      </div>
      <div className="w-2 h-2 mx-auto" style={{ background: 'var(--chinjan-yellow)' }} />
      <div className="w-1 h-3" style={{ background: 'var(--chinjan-green)' }} />
      <div className="w-3 h-2" style={{ background: '#d4a76a' }} />
    </div>
  );
}

function PixelServerRack() {
  return (
    <div className="w-8 h-14 bg-[#1a1a2e] border border-[#2a3a4a] p-0.5 flex flex-col gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-2 bg-[#0a1628] rounded-[1px] flex items-center px-0.5 gap-0.5">
          <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
          <div className="w-1 h-1 rounded-full bg-cyan-400/50" />
        </div>
      ))}
    </div>
  );
}

/** Chinjan-style pixel bookshelf (replaces server rack) */
function PixelBookshelf() {
  const colors = ['var(--chinjan-pink)', 'var(--chinjan-blue)', 'var(--chinjan-yellow)', 'var(--chinjan-green)', 'var(--chinjan-orange)'];
  return (
    <div className="w-8 h-14 border-2 p-0.5 flex flex-col gap-1 justify-end" style={{ borderColor: '#d4a76a', background: '#f5e6c8' }}>
      {[0, 1, 2].map(row => (
        <div key={row} className="flex gap-[1px]">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-3" style={{ background: colors[(row * 3 + i) % colors.length] }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PixelWaterCooler() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-4 h-4 rounded-t-sm bg-cyan-200/30 border border-cyan-300/20" />
      <div className="w-3 h-5 bg-[#e0e0e0]/20 border border-white/10" />
      <div className="w-4 h-1 bg-[#2a2a3a]" />
    </div>
  );
}

/** Chinjan-style pixel vending machine (replaces water cooler) */
function PixelVendingMachine() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-5 h-3 border-2" style={{ borderColor: 'var(--chinjan-pink)', background: 'var(--chinjan-surface)' }}>
        <div className="w-full h-full flex items-center justify-center" style={{ fontFamily: "'VT323', monospace", fontSize: 6, color: 'var(--chinjan-pink)' }}>♥</div>
      </div>
      <div className="w-5 h-5 border-2 border-t-0" style={{ borderColor: 'var(--chinjan-pink)', background: 'var(--chinjan-surface)' }}>
        <div className="flex gap-[1px] p-0.5 flex-wrap">
          {['var(--chinjan-pink)', 'var(--chinjan-blue)', 'var(--chinjan-yellow)', 'var(--chinjan-green)'].map((c, i) => (
            <div key={i} className="w-1.5 h-1.5" style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="w-5 h-1" style={{ background: 'var(--chinjan-border)' }} />
    </div>
  );
}

export function OfficeFloor({ conferenceAgents, mainOfficeAgents, onSelectAgent }: Props) {
  const { isActive: isChinjan } = useChinjanTheme();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RoomPanel title="Conference Room">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex justify-center gap-6 mb-2">
            {conferenceAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
              >
                <PixelAvatar color={agent.color} status={agent.status} size="md" />
                <span
                  className={isChinjan
                    ? 'chinjan-mono text-xs uppercase'
                    : 'font-mono text-[8px] text-cyan-400/60 uppercase'}
                  style={isChinjan ? { color: 'var(--chinjan-text)' } : undefined}
                >
                  {agent.name}
                </span>
              </button>
            ))}
          </div>
          <PixelDesk variant="round-table" />
          <div className="flex justify-between w-full px-4">
            <ChinjanOnly fallback={<PixelPlant />}><PixelFlowerDeco /></ChinjanOnly>
            <div
              className="w-16 h-10 border"
              style={isChinjan
                ? { background: 'var(--chinjan-bg)', borderColor: 'var(--chinjan-border)' }
                : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
            />
            <ChinjanOnly fallback={<PixelPlant />}><PixelFlowerDeco /></ChinjanOnly>
          </div>
        </div>
      </RoomPanel>

      <RoomPanel title="Command Center">
        <div className="flex flex-col items-center gap-4 py-4">
          <PixelDesk variant="command" />
          <div className="flex items-end gap-6">
            <ChinjanOnly fallback={<PixelWaterCooler />}><PixelVendingMachine /></ChinjanOnly>
            <div className="flex flex-col items-center gap-1">
              {mainOfficeAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent)}
                  className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
                >
                  <PixelAvatar color={agent.color} status={agent.status} size="lg" />
                  <span
                    className={isChinjan
                      ? 'chinjan-mono text-xs uppercase'
                      : 'font-mono text-[8px] text-cyan-400/60 uppercase'}
                    style={isChinjan ? { color: 'var(--chinjan-text)' } : undefined}
                  >
                    {agent.name}
                  </span>
                </button>
              ))}
            </div>
            <ChinjanOnly fallback={<PixelServerRack />}><PixelBookshelf /></ChinjanOnly>
          </div>
          <div className="flex justify-between w-full px-4">
            <ChinjanOnly fallback={<PixelPlant />}><PixelFlowerDeco /></ChinjanOnly>
            <ChinjanOnly fallback={<PixelPlant />}><PixelFlowerDeco /></ChinjanOnly>
          </div>
        </div>
      </RoomPanel>
    </div>
  );
}
