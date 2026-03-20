'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { LayoutGrid, Terminal, Settings, Menu, MessageCircle } from 'lucide-react';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';
import { findCharacterByRole } from '@/lib/backoffice/retrodesk-characters';

const ThemeSelector = dynamic(
  () => import('./ThemeSelector').then((m) => m.ThemeSelector),
  { ssr: false }
);
const PixelCharacter = dynamic(
  () => import('./retrodesk/PixelCharacter').then((m) => m.PixelCharacter),
  { ssr: false }
);

export type BackofficeTab = 'overview' | 'commander' | 'settings';

interface Props {
  agentCount: number;
  workingCount: number;
  onAddAgent: () => void;
  activeTab: BackofficeTab;
  onTabChange: (tab: BackofficeTab) => void;
  onToggleMobileSidebar?: () => void;
  chatOpen?: boolean;
  onToggleChat?: () => void;
}

const TAB_CONFIG: { key: BackofficeTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Team Overview', icon: LayoutGrid },
  { key: 'commander', label: 'Commander', icon: Terminal },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function Header({ agentCount, workingCount, onAddAgent, activeTab, onTabChange, onToggleMobileSidebar, chatOpen, onToggleChat }: Props) {
  const [time, setTime] = useState('');
  const { isActive: isRetroDesk } = useRetroDeskTheme();

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

  if (isRetroDesk) {
    return (
      <header className="relative z-20 flex flex-wrap items-center justify-between px-4 lg:px-6 py-3 border-b-2" style={{ borderColor: 'var(--retrodesk-border)', background: 'var(--retrodesk-surface)' }}>
        <div className="flex items-center gap-2 sm:gap-4">
          {activeTab === 'overview' && onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="md:hidden p-1.5 border-2 transition-colors"
              style={{ borderColor: 'var(--retrodesk-border)', color: 'var(--retrodesk-muted)' }}
              aria-label="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <Link href="/" className="text-[var(--retrodesk-muted)] hover:text-[var(--retrodesk-pink)] text-xs mr-2 transition-colors hidden sm:inline" style={{ fontFamily: "'Nunito', sans-serif" }}>
            &larr; Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <RetroDeskMascotMini />
          </div>
          <div className="hidden sm:flex items-center gap-2 ml-2 text-[10px] retrodesk-mono" style={{ color: 'var(--retrodesk-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#a8e6cf]" />
              {workingCount} ACTIVE
            </span>
            <span>|</span>
            <span>{agentCount} TOTAL</span>
          </div>
          {/* Tab buttons */}
          <div className="flex items-center gap-1 ml-2 sm:ml-4 flex-wrap">
            {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className="retrodesk-mono text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 border-2 transition-all tracking-wider uppercase flex items-center gap-1 sm:gap-1.5"
                style={{
                  borderColor: activeTab === key ? 'var(--retrodesk-pink)' : 'var(--retrodesk-border)',
                  color: activeTab === key ? 'var(--retrodesk-pink)' : 'var(--retrodesk-muted)',
                  background: activeTab === key ? 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' : 'transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSelector />
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className="retrodesk-mono text-xs px-2 py-1.5 border-2 transition-all relative"
              style={{
                borderColor: chatOpen ? 'var(--retrodesk-pink)' : 'var(--retrodesk-border)',
                color: chatOpen ? 'var(--retrodesk-pink)' : 'var(--retrodesk-muted)',
                background: chatOpen ? 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' : 'transparent',
              }}
              title="Team Chat"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {activeTab === 'overview' && (
            <button
              onClick={onAddAgent}
              className="retrodesk-mono text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 border-2 transition-all tracking-wider uppercase"
              style={{
                borderColor: 'var(--retrodesk-pink)',
                color: 'var(--retrodesk-pink)',
                background: 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)',
              }}
            >
              + <span className="hidden sm:inline">Add Agent</span><span className="sm:hidden">Add</span>
            </button>
          )}
          <div className="retrodesk-mono text-sm">
            <span className="text-[10px] mr-2 hidden sm:inline uppercase" style={{ color: 'var(--retrodesk-muted)' }}>Time:</span>
            <span style={{ color: 'var(--retrodesk-text)' }}>{time}</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--bo-border)] bg-[var(--bo-bg-glass)] backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-4">
        {activeTab === 'overview' && onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 border border-[var(--bo-border)] text-[var(--bo-text-muted)] hover:text-[var(--bo-text-accent)] transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <Link href="/" className="text-[var(--bo-text-dim)] hover:text-[var(--bo-text-accent)] text-xs mr-2 transition-colors hidden sm:inline">
          &larr; Dashboard
        </Link>
        <h1 className="font-mono text-sm lg:text-base text-[var(--bo-text-accent)] font-bold tracking-wider uppercase">
          Backoffice{' '}
          <span className="text-[var(--bo-text-muted)] text-[10px]">v0.0.2</span>
        </h1>
        <div className="hidden sm:flex items-center gap-2 ml-2 text-[10px] font-mono text-[var(--bo-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {workingCount} ACTIVE
          </span>
          <span className="text-[var(--bo-text-dimmer)]">|</span>
          <span>{agentCount} TOTAL</span>
        </div>
        {/* Tab buttons */}
        <div className="flex items-center gap-1 ml-2 sm:ml-4 flex-wrap">
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`font-mono text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 border transition-all tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 ${
                activeTab === key
                  ? 'bg-[var(--bo-accent-20)] border-[var(--bo-border-accent-hover)] text-[var(--bo-text-accent-2)]'
                  : 'bg-[var(--bo-accent-5)] border-[var(--bo-border-accent)] text-[var(--bo-text-muted)] hover:bg-[var(--bo-accent-10)] hover:text-[var(--bo-text-accent)] hover:border-[var(--bo-border-accent-hover)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeSelector />
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={`p-1.5 border transition-all ${
              chatOpen
                ? 'bg-[var(--bo-accent-20)] border-[var(--bo-border-accent-hover)] text-[var(--bo-text-accent-2)]'
                : 'border-[var(--bo-border)] text-[var(--bo-text-muted)] hover:text-[var(--bo-text-accent)] hover:border-[var(--bo-border-accent-hover)]'
            }`}
            title="Team Chat"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        )}
        {activeTab === 'overview' && (
          <button
            onClick={onAddAgent}
            className="font-mono text-[10px] bg-[var(--bo-accent-10)] border border-[var(--bo-border-accent)] text-[var(--bo-text-accent)] px-2 sm:px-4 py-1.5 sm:py-2 hover:bg-[var(--bo-accent-20)] hover:border-[var(--bo-border-accent-hover)] hover:shadow-[var(--bo-glow)] transition-all tracking-wider uppercase"
          >
            + <span className="hidden sm:inline">Add Agent</span><span className="sm:hidden">Add</span>
          </button>
        )}
        <div className="font-mono text-xs lg:text-sm">
          <span className="text-[var(--bo-text-dim)] text-[10px] mr-2 hidden sm:inline uppercase">Time:</span>
          <span className="text-[var(--bo-text-accent-2)] tabular-nums">{time}</span>
        </div>
      </div>
    </header>
  );
}

/** Tiny inline mascot for header */
function RetroDeskMascotMini() {
  const mascot = findCharacterByRole('mascot');
  if (!mascot) return null;
  return <PixelCharacter character={mascot} size="xs" animation="wave" />;
}
