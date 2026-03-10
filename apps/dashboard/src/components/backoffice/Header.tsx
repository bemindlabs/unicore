'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Props {
  agentCount: number;
  workingCount: number;
  onAddAgent: () => void;
}

export function Header({ agentCount, workingCount, onAddAgent }: Props) {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      const now = new Date();
      const h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      setTime(`${h12}:${m} ${ampm}`);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-cyan-900/30 bg-[#0a0e1a]/80 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-cyan-600/40 hover:text-cyan-400 text-xs mr-2 transition-colors">
          &larr; Dashboard
        </Link>
        <h1 className="font-mono text-sm lg:text-base text-cyan-400 font-bold tracking-wider uppercase">
          Team Overview{' '}
          <span className="text-cyan-600/60 text-[10px]">v3.2</span>
        </h1>
        <div className="hidden sm:flex items-center gap-2 ml-4 text-[10px] font-mono text-cyan-600/50">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {workingCount} ACTIVE
          </span>
          <span className="text-cyan-900">|</span>
          <span>{agentCount} TOTAL</span>
        </div>
      </div>

      <button
        onClick={onAddAgent}
        className="font-mono text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 px-4 py-2 hover:bg-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(0,229,255,0.1)] transition-all tracking-wider uppercase"
      >
        + Add Agent
      </button>

      <div className="font-mono text-xs lg:text-sm">
        <span className="text-cyan-600/40 text-[10px] mr-2 hidden sm:inline uppercase">Time:</span>
        <span className="text-cyan-300 tabular-nums">{time}</span>
      </div>
    </header>
  );
}
