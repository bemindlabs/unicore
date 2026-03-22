'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { usePtyWebSocket } from '@/hooks/use-pty-ws';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  agent: BackofficeAgent;
  open: boolean;
  onClose: () => void;
}

export function AgentTerminal({ agent, open, onClose }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const initRef = useRef(false);

  const handleOutput = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleExit = useCallback((exitCode: number) => {
    xtermRef.current?.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
  }, []);

  const { connected, sessionId, createSession, sendInput, sendResize, destroy } = usePtyWebSocket(handleOutput, handleExit);

  // Initialize xterm when panel opens
  useEffect(() => {
    if (!open || !termRef.current || initRef.current) return;
    initRef.current = true;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#484f58',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(links);
    terminal.open(termRef.current);

    // Fit after a frame to get correct dimensions
    requestAnimationFrame(() => {
      fit.fit();
    });

    terminal.onData((data) => sendInput(data));

    xtermRef.current = terminal;
    fitRef.current = fit;

    // ResizeObserver for auto-fit
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fit.fit();
        sendResize(terminal.cols, terminal.rows);
      });
    });
    observer.observe(termRef.current);

    return () => {
      observer.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitRef.current = null;
      initRef.current = false;
    };
  }, [open, sendInput, sendResize]);

  // Create PTY session when connected and terminal is ready
  useEffect(() => {
    if (connected && open && xtermRef.current && !sessionId) {
      const term = xtermRef.current;
      createSession(term.cols, term.rows, '/workspace');
    }
  }, [connected, open, sessionId, createSession]);

  // Handle close
  const handleClose = useCallback(() => {
    destroy();
    onClose();
  }, [destroy, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      style={{ background: '#0d1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/30" style={{ background: '#161b22' }}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-green-500">$</span>
          <span className="font-mono text-xs text-green-400 uppercase tracking-wider">{agent.name}</span>
          <span className={`font-mono text-[9px] ${connected ? 'text-green-500' : 'text-yellow-500 animate-pulse'}`}>
            {connected ? (sessionId ? 'CONNECTED' : 'STARTING...') : 'CONNECTING...'}
          </span>
        </div>
        <button onClick={handleClose} className="text-green-600/60 hover:text-green-400 text-lg leading-none px-1" aria-label="Close">
          &times;
        </button>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 overflow-hidden p-1" />
    </div>
  );
}
