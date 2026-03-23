'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Minus, Plus, Maximize2, PanelBottomClose, ExternalLink } from 'lucide-react';
import { cn } from '@unicore/ui';
import { SystemTerminal } from './SystemTerminal';

export type TerminalMode = 'modal' | 'docked';

interface TerminalModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (connected: boolean) => void;
}

const MODE_KEY = 'unicore:terminal:mode';
const DOCKED_HEIGHT_KEY = 'unicore:terminal:docked-h';
const DEFAULT_DOCKED_HEIGHT = 360;

function readMode(): TerminalMode {
  if (typeof window === 'undefined') return 'docked';
  const v = localStorage.getItem(MODE_KEY);
  return v === 'modal' || v === 'docked' ? v : 'docked';
}

function readDockedHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_DOCKED_HEIGHT;
  const v = parseInt(localStorage.getItem(DOCKED_HEIGHT_KEY) ?? '', 10);
  return isNaN(v) ? DEFAULT_DOCKED_HEIGHT : Math.max(200, Math.min(700, v));
}

export function TerminalModal({ open, onClose, onConnected }: TerminalModalProps) {
  const [mode, setModeState] = useState<TerminalMode>(readMode);
  const [minimized, setMinimized] = useState(false);
  const [dockedHeight, setDockedHeight] = useState(readDockedHeight);
  const resizeDragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Notify parent that terminal is active
  useEffect(() => {
    onConnected?.(open && !minimized);
  }, [open, minimized, onConnected]);

  // Escape closes modal mode
  useEffect(() => {
    if (!open || mode !== 'modal') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, mode, onClose]);

  const setMode = useCallback((m: TerminalMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  }, []);

  // Docked resize
  const startDockedResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeDragRef.current = { startY: e.clientY, startH: dockedHeight };
      const onMove = (ev: MouseEvent) => {
        if (!resizeDragRef.current) return;
        const h = Math.max(200, Math.min(700, resizeDragRef.current.startH - (ev.clientY - resizeDragRef.current.startY)));
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

  if (!open) return null;

  /* ── Title bar ─────────────────────────────────────────────────────── */
  const titleBar = (
    <div className="flex items-center justify-between h-10 px-3 border-b border-border/40 bg-muted/30 backdrop-blur-sm shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex gap-1">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs font-medium text-muted-foreground ml-2 truncate">
          UniCore Terminal
        </span>
        <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
          — Type /help for commands
        </span>
      </div>
      <div className="flex items-center gap-0.5 ml-2 shrink-0">
        {mode === 'modal' ? (
          <button
            onClick={() => setMode('docked')}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Dock to bottom"
          >
            <PanelBottomClose className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => setMode('modal')}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="Expand to modal"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setMinimized((v) => !v)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title={minimized ? 'Restore' : 'Minimize'}
        >
          {minimized ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const terminalContent = !minimized && (
    <div className="flex-1 min-h-0 overflow-hidden">
      <SystemTerminal />
    </div>
  );

  /* ── MODAL ────────────────────────────────────────────────────────── */
  if (mode === 'modal') {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-lg border shadow-2xl',
            'bg-background',
          )}
          style={{
            width: 'min(900px, 90vw)',
            height: minimized ? 'auto' : 'min(600px, 80vh)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {titleBar}
          {terminalContent}
        </div>
      </>
    );
  }

  /* ── DOCKED ───────────────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t shadow-[0_-4px_20px_rgba(0,0,0,0.15)]',
        'bg-background',
      )}
      style={{ height: minimized ? 'auto' : dockedHeight }}
    >
      {!minimized && (
        <div
          className="h-1 w-full shrink-0 cursor-ns-resize group"
          onMouseDown={startDockedResize}
        >
          <div className="h-full w-16 mx-auto rounded-full bg-muted-foreground/20 group-hover:bg-muted-foreground/40 transition-colors mt-px" />
        </div>
      )}
      {titleBar}
      {terminalContent}
    </div>
  );
}
