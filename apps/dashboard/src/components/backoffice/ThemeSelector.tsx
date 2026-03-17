'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';
import { THEME_OPTIONS } from '@/lib/backoffice/theme-registry';
import type { ThemeOption } from '@/lib/backoffice/theme-registry';
import { findCharacterByRole } from '@/lib/backoffice/retrodesk-characters';

// ---------------------------------------------------------------------------
// Dropdown animation styles — injected once via useEffect
// ---------------------------------------------------------------------------
const DROPDOWN_STYLE_ID = 'theme-selector-animation';
const DROPDOWN_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .theme-selector-dropdown {
    animation: themeSelectorSlideIn 150ms ease-out;
  }
}
@keyframes themeSelectorSlideIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}`;

function useDropdownStyles() {
  useEffect(() => {
    if (document.getElementById(DROPDOWN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = DROPDOWN_STYLE_ID;
    style.textContent = DROPDOWN_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Mini mascot pixel preview (reused from RetroDeskThemeToggle)
// ---------------------------------------------------------------------------
const MINI_PX = 2;

function MiniMascot() {
  const mascot = findCharacterByRole('mascot');
  if (!mascot) return null;

  const grid = mascot.grid.slice(0, 8);
  const cols = grid[0]?.length ?? 12;
  const rows = grid.length;

  const shadows = grid
    .flatMap((row, y) =>
      row.map((cell, x) =>
        cell === 'transparent' ? null : `${x * MINI_PX}px ${y * MINI_PX}px 0 0 ${cell}`,
      ),
    )
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ width: cols * MINI_PX, height: rows * MINI_PX, position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: MINI_PX,
          height: MINI_PX,
          boxShadow: shadows,
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option row
// ---------------------------------------------------------------------------
function OptionRow({
  option,
  selected,
  focused,
  isRetroDesk,
  onSelect,
}: {
  option: ThemeOption;
  selected: boolean;
  focused: boolean;
  isRetroDesk: boolean;
  onSelect: (id: string) => void;
}) {
  const selectedStyle = isRetroDesk
    ? { background: 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)', color: 'var(--retrodesk-pink)' }
    : undefined;
  const focusedStyle = !selected && focused
    ? isRetroDesk
      ? { background: 'color-mix(in srgb, var(--retrodesk-pink) 5%, transparent)' }
      : undefined
    : undefined;

  return (
    <div
      id={`theme-option-${option.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      data-theme-option={option.id}
      onClick={() => onSelect(option.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(option.id);
        }
      }}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer',
        isRetroDesk ? 'retrodesk-mono' : 'font-mono',
        selected
          ? isRetroDesk
            ? ''
            : 'bg-cyan-500/15 text-cyan-300'
          : isRetroDesk
            ? ''
            : focused
              ? 'bg-cyan-500/10 text-cyan-300'
              : 'text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-300',
      ].filter(Boolean).join(' ')}
      style={{
        ...selectedStyle,
        ...focusedStyle,
        ...(
          !selected && !focused && isRetroDesk
            ? { color: 'var(--retrodesk-text)' }
            : undefined
        ),
        outline: focused ? '2px solid currentColor' : undefined,
        outlineOffset: '-2px',
      }}
    >
      {/* Icon / pixel preview */}
      <span className="text-base leading-none w-5 flex items-center justify-center">
        {option.id === 'retrodesk' ? <MiniMascot /> : <span>{option.icon}</span>}
      </span>

      {/* Label + description */}
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] tracking-wider uppercase">{option.label}</span>
        <span
          className={`block text-[9px] ${
            isRetroDesk ? '' : 'text-cyan-600/50'
          }`}
          style={isRetroDesk ? { color: 'var(--retrodesk-muted)' } : undefined}
        >
          {option.description}
        </span>
      </span>

      {/* Checkmark */}
      {selected && (
        <span className="text-[11px] leading-none ml-auto" aria-hidden="true">
          {isRetroDesk ? '\u{2588}' : '\u2713'}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThemeSelector (the dropdown)
// ---------------------------------------------------------------------------
export function ThemeSelector() {
  const { selectedThemeId, setThemeById } = useTheme();
  const { isActive: isRetroDesk } = useRetroDeskTheme();
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  useDropdownStyles();

  const activeId = selectedThemeId;
  const activeOption = THEME_OPTIONS.find((t) => t.id === activeId) ?? THEME_OPTIONS[0] ?? null;

  // Reset focus index when dropdown opens/closes
  useEffect(() => {
    if (open) {
      const idx = THEME_OPTIONS.findIndex((t) => t.id === selectedThemeId);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [open, activeId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < THEME_OPTIONS.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : THEME_OPTIONS.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          setFocusedIndex((prev) => {
            const opt = THEME_OPTIONS[prev];
            if (opt) handleSelect(opt.id);
            return prev;
          });
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(THEME_OPTIONS.length - 1);
          break;
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (id: string) => {
      setThemeById(id);
      setOpen(false);
    },
    [setThemeById],
  );

  // Guard: if THEME_OPTIONS is somehow empty, render nothing
  if (THEME_OPTIONS.length === 0 || !activeOption) {
    return null;
  }

  // Button styling
  const btnBase = 'flex items-center gap-2 px-3 py-1.5 border text-[10px] tracking-wider uppercase transition-all select-none';
  const btnRetro =
    'border-[var(--retrodesk-border)] hover:border-[var(--retrodesk-pink)] retrodesk-mono';
  const btnDefault =
    'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/50 font-mono';

  // Panel styling
  const panelBase =
    'absolute right-0 top-full mt-1 z-50 min-w-[200px] border overflow-hidden shadow-lg';
  const panelDefault =
    'border-cyan-900/40 bg-[#0a0e1a]/95 backdrop-blur-md';

  const focusedOptionId = THEME_OPTIONS[focusedIndex]?.id;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={`${btnBase} ${isRetroDesk ? btnRetro : btnDefault}`}
        style={isRetroDesk ? { color: 'var(--retrodesk-text)' } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch theme, current: ${activeOption.label}`}
        title="Switch theme"
      >
        {activeOption.id === 'retrodesk' ? <MiniMascot /> : <span className="text-sm leading-none">{activeOption.icon}</span>}
        <span>{activeOption.label}</span>
        <span
          className={`text-[8px] ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ display: 'inline-block' }}
          aria-hidden="true"
        >
          &#9662;
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={listboxRef}
          className={`${panelBase} ${isRetroDesk ? '' : panelDefault} theme-selector-dropdown`}
          style={isRetroDesk ? {
            border: '2px solid var(--retrodesk-border)',
            background: 'var(--retrodesk-surface)',
          } : undefined}
          role="listbox"
          aria-label="Theme options"
          aria-activedescendant={focusedOptionId ? `theme-option-${focusedOptionId}` : undefined}
        >
          {THEME_OPTIONS.map((opt, idx) => (
            <OptionRow
              key={opt.id}
              option={opt}
              selected={opt.id === activeId}
              focused={idx === focusedIndex}
              isRetroDesk={isRetroDesk}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
