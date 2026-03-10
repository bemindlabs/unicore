'use client';

import type { BackofficeAgent } from '@/lib/backoffice/types';
import { PixelAvatar } from './PixelAvatar';
import { StatusIndicator } from './StatusIndicator';

interface Props {
  conferenceAgents: BackofficeAgent[];
  mainOfficeAgents: BackofficeAgent[];
  onSelectAgent: (agent: BackofficeAgent) => void;
}

function RoomPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-cyan-900/40 bg-[#0b1120]/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-cyan-900/30">
        <span className="font-mono text-[10px] text-cyan-500/80 tracking-wider uppercase">{title}</span>
        <StatusIndicator status="working" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function PixelDesk({ variant = 'standard' }: { variant?: 'standard' | 'command' | 'round-table' }) {
  if (variant === 'round-table') {
    return (
      <div className="relative mx-auto" style={{ width: 160, height: 80 }}>
        <div
          className="absolute inset-0 rounded-[50%] border-2 border-[#5a4a3a]"
          style={{ background: 'linear-gradient(135deg, #4a3a2a, #3a2a1a)' }}
        />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
          <div
            key={angle}
            className="absolute w-3 h-3 bg-[#2a2a3a] border border-[#3a3a4a]"
            style={{
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
            <div className="w-10 h-7 bg-[#0a1628] border border-[#1a3a5a] relative overflow-hidden">
              <div className="absolute inset-0.5 opacity-60">
                {[0, 1, 2, 3].map(line => (
                  <div
                    key={line}
                    className="h-[2px] mb-[2px] rounded-full"
                    style={{
                      width: `${40 + Math.random() * 50}%`,
                      background: i === 0 ? '#00ff88' : i === 1 ? '#00e5ff' : '#4fc3f7',
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="w-2 h-1 bg-[#2a2a3a]" />
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

function PixelWaterCooler() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-4 h-4 rounded-t-sm bg-cyan-200/30 border border-cyan-300/20" />
      <div className="w-3 h-5 bg-[#e0e0e0]/20 border border-white/10" />
      <div className="w-4 h-1 bg-[#2a2a3a]" />
    </div>
  );
}

export function OfficeFloor({ conferenceAgents, mainOfficeAgents, onSelectAgent }: Props) {
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
                <span className="font-mono text-[8px] text-cyan-400/60 uppercase">{agent.name}</span>
              </button>
            ))}
          </div>
          <PixelDesk variant="round-table" />
          <div className="flex justify-between w-full px-4">
            <PixelPlant />
            <div className="w-16 h-10 bg-white/5 border border-white/10" />
            <PixelPlant />
          </div>
        </div>
      </RoomPanel>

      <RoomPanel title="Command Center">
        <div className="flex flex-col items-center gap-4 py-4">
          <PixelDesk variant="command" />
          <div className="flex items-end gap-6">
            <PixelWaterCooler />
            <div className="flex flex-col items-center gap-1">
              {mainOfficeAgents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgent(agent)}
                  className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
                >
                  <PixelAvatar color={agent.color} status={agent.status} size="lg" />
                  <span className="font-mono text-[8px] text-cyan-400/60 uppercase">{agent.name}</span>
                </button>
              ))}
            </div>
            <PixelServerRack />
          </div>
          <div className="flex justify-between w-full px-4">
            <PixelPlant />
            <PixelPlant />
          </div>
        </div>
      </RoomPanel>
    </div>
  );
}
