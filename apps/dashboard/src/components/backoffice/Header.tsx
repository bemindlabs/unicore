'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useChinjanTheme } from './chinjan/ChinjanThemeProvider';
import { findCharacterByRole } from '@/lib/backoffice/chinjan-characters';

const ChinjanThemeToggle = dynamic(
  () => import('./chinjan/ChinjanThemeToggle').then((m) => m.ChinjanThemeToggle),
  { ssr: false }
);
const PixelCharacter = dynamic(
  () => import('./chinjan/PixelCharacter').then((m) => m.PixelCharacter),
  { ssr: false }
);

interface Props {
  agentCount: number;
  workingCount: number;
  onAddAgent: () => void;
}

export function Header({ agentCount, workingCount, onAddAgent }: Props) {
  const [time, setTime] = useState('');
  const { isActive: isChinjan } = useChinjanTheme();

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

  if (isChinjan) {
    return (
      <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b-2" style={{ borderColor: 'var(--chinjan-border)', background: 'var(--chinjan-surface)' }}>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--chinjan-muted)] hover:text-[var(--chinjan-pink)] text-xs mr-2 transition-colors" style={{ fontFamily: "'Nunito', sans-serif" }}>
            &larr; Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <ChinjanMascotMini />
            <h1 className="chinjan-heading text-[10px] lg:text-xs tracking-wider uppercase" style={{ color: 'var(--chinjan-pink)' }}>
              Team Overview
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-4 text-[10px] chinjan-mono" style={{ color: 'var(--chinjan-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#a8e6cf]" />
              {workingCount} ACTIVE
            </span>
            <span>|</span>
            <span>{agentCount} TOTAL</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChinjanThemeToggle />
          <button
            onClick={onAddAgent}
            className="chinjan-mono text-sm px-4 py-2 border-2 transition-all tracking-wider uppercase"
            style={{
              borderColor: 'var(--chinjan-pink)',
              color: 'var(--chinjan-pink)',
              background: 'color-mix(in srgb, var(--chinjan-pink) 10%, transparent)',
            }}
          >
            + Add Agent
          </button>
          <div className="chinjan-mono text-sm">
            <span className="text-[10px] mr-2 hidden sm:inline uppercase" style={{ color: 'var(--chinjan-muted)' }}>Time:</span>
            <span style={{ color: 'var(--chinjan-text)' }}>{time}</span>
          </div>
        </div>
      </header>
    );
  }

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

      <div className="flex items-center gap-3">
        <ChinjanThemeToggle />
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
      </div>
    </header>
  );
}

/** Tiny inline mascot for header */
function ChinjanMascotMini() {
  const mascot = findCharacterByRole('mascot');
  if (!mascot) return null;
  return <PixelCharacter character={mascot} size="xs" animation="wave" />;
}
