'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';

const TerminalEmulator = lazy(() =>
  import('./terminal-emulator').then((m) => ({ default: m.TerminalEmulator })),
);

export type TerminalMode = 'modal' | 'docked' | 'popout';

interface TerminalModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (connected: boolean) => void;
  title?: string;
}

const MODE_KEY = 'terminal-modal-mode';
const DOCKED_HEIGHT_KEY = 'terminal-modal-docked-height';
const POPOUT_POS_KEY = 'terminal-modal-popout-pos';
const DEFAULT_DOCKED_HEIGHT = 320;

function readMode(): TerminalMode {
  if (typeof window === 'undefined') return 'modal';
  const v = localStorage.getItem(MODE_KEY);
  return v === 'modal' || v === 'docked' || v === 'popout' ? v : 'modal';
}

function readDockedHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_DOCKED_HEIGHT;
  const v = parseInt(localStorage.getItem(DOCKED_HEIGHT_KEY) ?? '', 10);
  return isNaN(v) ? DEFAULT_DOCKED_HEIGHT : Math.max(150, Math.min(800, v));
}

function readPopoutPos(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 80, y: 80 };
  try {
    const v = JSON.parse(localStorage.getItem(POPOUT_POS_KEY) ?? '{}');
    return typeof v.x === 'number' && typeof v.y === 'number' ? v : { x: 80, y: 80 };
  } catch {
    return { x: 80, y: 80 };
  }
}

export function TerminalModal({ open, onClose, onConnected, title = 'Terminal' }: TerminalModalProps) {
  const [connected, setConnected] = useState(false);
  const [mode, setModeState] = useState<TerminalMode>(readMode);
  const [minimized, setMinimized] = useState(false);
  const [dockedHeight, setDockedHeight] = useState(readDockedHeight);
  const [popoutPos, setPopoutPos] = useState(readPopoutPos);

  const wsRef = useRef<WebSocket | null>(null);
  const resizeDragRef = useRef<{ startY: number; startH: number } | null>(null);
  const moveDragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const setConnectedState = useCallback(
    (value: boolean) => {
      setConnected(value);
      onConnected?.(value);
    },
    [onConnected],
  );

  // Mark connected when modal opens (PTY connects internally)
  useEffect(() => {
    if (open) {
      // Small delay to allow emulator to establish WebSocket
      const t = setTimeout(() => setConnectedState(true), 1000);
      return () => clearTimeout(t);
    }
    setConnectedState(false);
  }, [open, setConnectedState]);

  // Escape key closes modal mode
  useEffect(() => {
    if (!open || mode !== 'modal') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, mode, onClose]);

  // Persist mode to localStorage
  const setMode = useCallback((m: TerminalMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  // Docked resize — drag top edge
  const startDockedResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeDragRef.current = { startY: e.clientY, startH: dockedHeight };
      const onMove = (ev: MouseEvent) => {
        if (!resizeDragRef.current) return;
        const h = Math.max(150, Math.min(800, resizeDragRef.current.startH - (ev.clientY - resizeDragRef.current.startY)));
        setDockedHeight(h);
        localStorage.setItem(DOCKED_HEIGHT_KEY, String(h));
      };
      const onUp = () => {
        resizeDragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [dockedHeight],
  );

  // Popout drag-to-move title bar
  const startPopoutMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      moveDragRef.current = { sx: e.clientX, sy: e.clientY, px: popoutPos.x, py: popoutPos.y };
      const onMove = (ev: MouseEvent) => {
        if (!moveDragRef.current) return;
        const pos = {
          x: Math.max(0, moveDragRef.current.px + ev.clientX - moveDragRef.current.sx),
          y: Math.max(0, moveDragRef.current.py + ev.clientY - moveDragRef.current.sy),
        };
        setPopoutPos(pos);
        localStorage.setItem(POPOUT_POS_KEY, JSON.stringify(pos));
      };
      const onUp = () => {
        moveDragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [popoutPos],
  );

  if (!open) return null;

  const statusDot = (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${
        connected ? 'bg-green-500 shadow-[0_0_4px_#00ff41]' : 'bg-yellow-500 animate-pulse'
      }`}
    />
  );

  /* ── Title bar ─────────────────────────────────────────────────────────── */
  const TitleBar = ({
    draggable,
    onDragStart,
  }: {
    draggable?: boolean;
    onDragStart?: (e: React.MouseEvent) => void;
  }) => (
    <div
      className={`flex items-center justify-between h-9 px-3 border-b border-green-900/40 flex-shrink-0 select-none${draggable ? ' cursor-move' : ''}`}
      style={{ background: '#050505', fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}
      onMouseDown={draggable ? onDragStart : undefined}
    >
      {/* Left */}
      <div className="flex items-center gap-2 text-xs min-w-0">
        <span className="text-green-600">$_</span>
        <span className="text-green-400 uppercase tracking-widest truncate">{title}</span>
        <span className="flex items-center text-[10px] text-green-600/80">
          {statusDot}
          {connected ? 'CONNECTED' : 'CONNECTING'}
        </span>
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-0 ml-2 flex-shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace' }}
      >
        {mode !== 'docked' && (
          <TitleBtn label="dock" onClick={() => setMode('docked')} title="Dock to bottom panel" />
        )}
        {mode !== 'popout' && (
          <TitleBtn label="popout" onClick={() => setMode('popout')} title="Free-floating window" />
        )}
        {mode !== 'modal' && (
          <TitleBtn label="modal" onClick={() => setMode('modal')} title="Centered modal" />
        )}
        <TitleBtn
          label={minimized ? '[+]' : '[-]'}
          onClick={() => setMinimized((v) => !v)}
          title={minimized ? 'Restore' : 'Minimize'}
          raw
        />
        <TitleBtn label="[x]" onClick={onClose} title="Close" danger raw />
      </div>
    </div>
  );

  /* ── Terminal content (xterm.js + PTY WebSocket) ─────────────────────── */
  const TerminalBody = () => (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center" style={{ background: '#0d1117' }}>
          <span className="text-green-500/60 font-mono text-xs animate-pulse">Loading terminal...</span>
        </div>
      }
    >
      <TerminalEmulator className="flex-1" cwd="/workspace" />
    </Suspense>
  );

  /* ── MODAL (centered 80% viewport) ─────────────────────────────────────── */
  if (mode === 'modal') {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm" onClick={onClose} />
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded border border-green-900/30 shadow-[0_0_60px_rgba(0,255,65,0.08)]"
          style={{
            background: '#000000',
            width: '80vw',
            height: minimized ? 'auto' : '80vh',
            top: '10vh',
            left: '10vw',
          }}
        >
          <TitleBar />
          {!minimized && <TerminalBody />}
        </div>
      </>
    );
  }

  /* ── DOCKED (bottom, resizable) ─────────────────────────────────────────── */
  if (mode === 'docked') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-green-900/30 shadow-[0_-8px_40px_rgba(0,255,65,0.07)]"
        style={{
          background: '#000000',
          height: minimized ? 'auto' : dockedHeight,
        }}
      >
        {/* Drag handle */}
        {!minimized && (
          <div
            className="h-1.5 w-full flex-shrink-0 cursor-ns-resize bg-green-900/10 hover:bg-green-700/25 transition-colors"
            onMouseDown={startDockedResize}
          />
        )}
        <TitleBar />
        {!minimized && <TerminalBody />}
      </div>
    );
  }

  /* ── POPOUT (free-floating, draggable) ──────────────────────────────────── */
  if (mode === 'popout') {
    return (
      <div
        className="fixed z-50 flex flex-col overflow-hidden rounded border border-green-900/40 shadow-[0_0_40px_rgba(0,255,65,0.1)]"
        style={{
          background: '#000000',
          width: minimized ? 320 : 680,
          height: minimized ? 'auto' : 420,
          left: popoutPos.x,
          top: popoutPos.y,
        }}
      >
        <TitleBar draggable onDragStart={startPopoutMove} />
        {!minimized && <TerminalBody />}
      </div>
    );
  }

  return null;
}

/* ── Small button ─────────────────────────────────────────────────────────── */
function TitleBtn({
  label,
  onClick,
  title,
  danger,
  raw,
}: {
  label: string;
  onClick: () => void;
  title?: string;
  danger?: boolean;
  raw?: boolean;
}) {
  const text = raw || label.startsWith('[') ? label : `[${label}]`;
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
        danger
          ? 'text-red-800 hover:text-red-400 hover:bg-red-900/20'
          : 'text-green-800 hover:text-green-400 hover:bg-green-900/20'
      }`}
      style={{ fontFamily: 'inherit' }}
    >
      {text}
    </button>
  );
}
