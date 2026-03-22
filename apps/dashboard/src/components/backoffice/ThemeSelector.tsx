'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';
import { THEME_OPTIONS, CHARACTER_SKINS, getActiveSkinId, isRetroDeskFamily } from '@/lib/backoffice/theme-registry';
import type { ThemeOption, CharacterSkin } from '@/lib/backoffice/theme-registry';
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
            : 'bg-[var(--bo-accent-15)] text-[var(--bo-text-accent-2)]'
          : isRetroDesk
            ? ''
            : focused
              ? 'bg-[var(--bo-accent-10)] text-[var(--bo-text-accent-2)]'
              : 'text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-10)] hover:text-[var(--bo-text-accent-2)]',
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
            isRetroDesk ? '' : 'text-[var(--bo-text-muted)]'
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
// Character Skin sub-selector (shown when RetroDesk/Crypto is active)
// ---------------------------------------------------------------------------
function CharacterSkinSelector({
  isRetroDesk,
  characterTheme,
  onSelectSkin,
}: {
  isRetroDesk: boolean;
  characterTheme: string | null;
  onSelectSkin: (themeValue: string | null) => void;
}) {
  if (!isRetroDesk) return null;

  const activeSkinId = getActiveSkinId(characterTheme);

  return (
    <div
      style={{
        borderTop: isRetroDesk
          ? '1px solid var(--retrodesk-border)'
          : '1px solid var(--bo-border-accent)',
        padding: '6px 0 4px',
      }}
    >
      <div
        className={isRetroDesk ? 'retrodesk-mono' : 'font-mono'}
        style={{
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: '0 12px 4px',
          color: isRetroDesk ? 'var(--retrodesk-muted)' : 'var(--bo-text-muted)',
        }}
      >
        Character Skin
      </div>
      {/* Default / no skin option */}
      <div
        role="option"
        aria-selected={activeSkinId === null}
        onClick={() => onSelectSkin(null)}
        className={[
          'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer',
          isRetroDesk ? 'retrodesk-mono' : 'font-mono',
        ].join(' ')}
        style={{
          color: activeSkinId === null
            ? (isRetroDesk ? 'var(--retrodesk-pink)' : 'var(--bo-text-accent-2)')
            : (isRetroDesk ? 'var(--retrodesk-text)' : 'var(--bo-text-accent)'),
          background: activeSkinId === null
            ? (isRetroDesk ? 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' : 'var(--bo-accent-15)')
            : undefined,
        }}
      >
        <span className="text-sm leading-none w-5 flex items-center justify-center">{'\u2B50'}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] tracking-wider uppercase">Default</span>
        </span>
        {activeSkinId === null && (
          <span className="text-[11px] leading-none ml-auto" aria-hidden="true">
            {isRetroDesk ? '\u{2588}' : '\u2713'}
          </span>
        )}
      </div>
      {/* Skin options */}
      {CHARACTER_SKINS.map((skin) => {
        const isSelected = activeSkinId === skin.id;
        return (
          <div
            key={skin.id}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelectSkin(skin.themeValue)}
            className={[
              'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer',
              isRetroDesk ? 'retrodesk-mono' : 'font-mono',
            ].join(' ')}
            style={{
              color: isSelected
                ? (isRetroDesk ? 'var(--retrodesk-pink)' : 'var(--bo-text-accent-2)')
                : (isRetroDesk ? 'var(--retrodesk-text)' : 'var(--bo-text-accent)'),
              background: isSelected
                ? (isRetroDesk ? 'color-mix(in srgb, var(--retrodesk-pink) 10%, transparent)' : 'var(--bo-accent-15)')
                : undefined,
            }}
          >
            <span className="text-sm leading-none w-5 flex items-center justify-center">{skin.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] tracking-wider uppercase">{skin.label}</span>
            </span>
            {isSelected && (
              <span className="text-[11px] leading-none ml-auto" aria-hidden="true">
                {isRetroDesk ? '\u{2588}' : '\u2713'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ThemeSelector (the dropdown)
// ---------------------------------------------------------------------------
export function ThemeSelector() {
  const { selectedThemeId, setThemeById, characterTheme, setCharacterTheme } = useTheme();
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
  }, [open, selectedThemeId]);

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

  const handleSkinSelect = useCallback(
    (themeValue: string | null) => {
      if (themeValue) {
        // Apply the skin variant (e.g. "retrodesk-pepe")
        setCharacterTheme(themeValue);
        localStorage.setItem('character-skin', themeValue);
      } else {
        // Reset to the base theme (retrodesk or crypto)
        setCharacterTheme(selectedThemeId);
        localStorage.removeItem('character-skin');
      }
      // Reload to fully apply the skin CSS variables
      window.location.reload();
    },
    [setCharacterTheme, selectedThemeId],
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
    'bg-[var(--bo-accent-10)] border-[var(--bo-border-accent)] text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-20)] hover:border-[var(--bo-border-accent-hover)] font-mono';

  // Panel styling
  const panelBase =
    'fixed sm:absolute right-2 sm:right-0 top-auto sm:top-full mt-1 z-50 min-w-[200px] max-w-[calc(100vw-1rem)] border overflow-hidden shadow-lg';
  const panelDefault =
    'border-[var(--bo-border-strong)] bg-[var(--bo-bg)] backdrop-blur-md';

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
          <CharacterSkinSelector
            isRetroDesk={isRetroDesk}
            characterTheme={characterTheme}
            onSelectSkin={handleSkinSelect}
          />
        </div>
      )}
    </div>
  );
}
