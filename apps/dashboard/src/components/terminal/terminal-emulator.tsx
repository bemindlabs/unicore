'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { usePtyWebSocket } from '@/hooks/use-pty-ws';

interface TerminalEmulatorProps {
  /** Working directory for the PTY session */
  cwd?: string;
  /** Additional CSS class names */
  className?: string;
  /** Called when the PTY session exits */
  onExit?: (exitCode: number) => void;
}

export function TerminalEmulator({ cwd = '/', className = '', onExit }: TerminalEmulatorProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOutput = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleExit = useCallback((exitCode: number) => {
    xtermRef.current?.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
    onExit?.(exitCode);
  }, [onExit]);

  const { connected, sessionId, error, createSession, sendInput, sendResize, destroy } =
    usePtyWebSocket(handleOutput, handleExit);

  // Initialize xterm.js
  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
      scrollback: 1000,
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

    requestAnimationFrame(() => fit.fit());

    // Forward keystrokes to PTY
    terminal.onData((data) => sendInput(data));

    // Copy selection to clipboard automatically
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }).catch(() => {/* clipboard access denied */});
      }
    });

    xtermRef.current = terminal;
    fitRef.current = fit;

    // Auto-resize via ResizeObserver
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
    };
  }, [sendInput, sendResize]);

  // Create PTY session once connected and terminal is ready
  useEffect(() => {
    if (connected && xtermRef.current && !sessionId) {
      const term = xtermRef.current;
      createSession(term.cols, term.rows, cwd);
    }
  }, [connected, sessionId, createSession, cwd]);

  // Destroy PTY session on unmount
  useEffect(() => {
    return () => { destroy(); };
  }, [destroy]);

  const statusText = error
    ? `ERROR: ${error}`
    : connected
      ? sessionId ? 'CONNECTED' : 'STARTING...'
      : 'CONNECTING...';

  const statusColor = error
    ? 'text-red-500'
    : connected
      ? sessionId ? 'text-green-500' : 'text-yellow-500 animate-pulse'
      : 'text-yellow-500 animate-pulse';

  return (
    <div className={`flex flex-col ${className}`} style={{ background: '#0d1117' }}>
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-green-900/30 shrink-0"
        style={{ background: '#161b22' }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-500">$</span>
          <span className="font-mono text-xs text-green-400 uppercase tracking-wider">terminal</span>
          <span className={`font-mono text-[9px] ${statusColor}`}>{statusText}</span>
        </div>
        {copied && (
          <span className="font-mono text-[9px] text-blue-400">copied</span>
        )}
      </div>

      {/* xterm.js mount point */}
      <div ref={termRef} className="flex-1 overflow-hidden p-1" />
    </div>
  );
}
