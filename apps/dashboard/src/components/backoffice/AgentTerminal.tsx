'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { usePtyWebSocket } from '@/hooks/use-pty-ws';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import {
  TERMINAL_THEMES,
  TERMINAL_FONTS,
  getStoredTheme,
  setStoredTheme,
  getStoredFont,
  setStoredFont,
  parseThemeCommand,
  injectCrtStyles,
  type TerminalThemeId,
  type TerminalFontId,
} from '@/components/terminal/themes';

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

  // Theme/font state — drives re-theming without full reinit
  const [themeId, setThemeId] = useState<TerminalThemeId>(getStoredTheme);
  const [fontId, setFontId] = useState<TerminalFontId>(getStoredFont);

  const handleOutput = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleExit = useCallback((exitCode: number) => {
    xtermRef.current?.writeln(`\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`);
  }, []);

  const { connected, sessionId, error, createSession, sendInput, sendResize, destroy } =
    usePtyWebSocket(handleOutput, handleExit);

  // Initialize xterm when panel opens
  useEffect(() => {
    if (!open || !termRef.current || initRef.current) return;
    initRef.current = true;

    injectCrtStyles();

    const theme = TERMINAL_THEMES[themeId];
    const font = TERMINAL_FONTS[fontId];

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: font.fontFamily,
      theme: theme.xterm,
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

    // Intercept /theme and /font commands; forward everything else to PTY
    let inputBuffer = '';

    terminal.onData((data) => {
      // Carriage return = user pressed Enter — check buffer for commands
      if (data === '\r') {
        const result = parseThemeCommand(inputBuffer);
        inputBuffer = '';

        if (result.type === 'not-a-command') {
          sendInput(data);
          return;
        }

        // Echo the command result in the terminal
        terminal.write(result.message);

        if (result.type === 'theme-changed') {
          setStoredTheme(result.themeId);
          setThemeId(result.themeId);
        } else if (result.type === 'font-changed') {
          setStoredFont(result.fontId);
          setFontId(result.fontId);
        }
        // For help/error we already wrote the message — done.
        return;
      }

      // Backspace
      if (data === '\x7f') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
        }
        sendInput(data);
        return;
      }

      // Accumulate printable chars into buffer (for command detection)
      if (inputBuffer.length < 256 && !data.startsWith('\x1b')) {
        inputBuffer += data;
      }

      sendInput(data);
    });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only run on open
  }, [open, sendInput, sendResize]);

  // Re-apply theme when themeId changes (after /theme command)
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.theme = TERMINAL_THEMES[themeId].xterm;
  }, [themeId]);

  // Re-apply font when fontId changes (after /font command)
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    term.options.fontFamily = TERMINAL_FONTS[fontId].fontFamily;
    fitRef.current?.fit();
  }, [fontId]);

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

  const theme = TERMINAL_THEMES[themeId];
  const bg = (theme.xterm.background ?? '#0d1117') as string;
  const headerBg = bg === '#000000' || bg === '#010f01' ? '#0a0a0a' : '#161b22';
  const accentColor = (theme.xterm.green ?? '#7ee787') as string;

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col shadow-2xl animate-in slide-in-from-right duration-200${theme.cssClass ? ` ${theme.cssClass}` : ''}`}
      style={{ background: bg, ...theme.wrapperStyle }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ background: headerBg, borderColor: `${accentColor}22` }}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs" style={{ color: accentColor }}>$</span>
          <span className="font-mono text-xs uppercase tracking-wider" style={{ color: accentColor }}>
            {agent.name}
          </span>
          <span
            className={`font-mono text-[9px] ${
              connected
                ? ''
                : error
                ? 'text-red-500'
                : 'animate-pulse text-yellow-500'
            }`}
            style={connected ? { color: accentColor } : undefined}
          >
            {connected
              ? sessionId
                ? 'CONNECTED'
                : 'STARTING...'
              : error
              ? `ERROR: ${error}`
              : 'CONNECTING...'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] opacity-40" style={{ color: accentColor }}>
            {theme.name} · {TERMINAL_FONTS[fontId].name}
          </span>
          <button
            onClick={handleClose}
            className="text-lg leading-none px-1 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: accentColor }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 overflow-hidden p-1" />
    </div>
  );
}
