'use client';

import { useState, useRef, useEffect } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { api } from '@/lib/api';

interface Props {
  agent: BackofficeAgent;
  open: boolean;
  onClose: () => void;
}

interface TerminalLine {
  id: number;
  type: 'input' | 'stdout' | 'stderr' | 'system';
  text: string;
}

export function AgentTerminal({ agent, open, onClose }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [_historyIdx, setHistoryIdx] = useState(-1);
  const [cwd, setCwd] = useState('/app');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lineIdRef = useRef(0);

  const addLine = (type: TerminalLine['type'], text: string) => {
    const id = ++lineIdRef.current;
    setLines((prev) => [...prev.slice(-500), { id, type, text }]);
  };

  useEffect(() => {
    if (open) {
      setLines([]);
      lineIdRef.current = 0;
      addLine('system', `UniCore Terminal — ${agent.name} (${agent.role})`);
      addLine('system', 'Shell running inside OpenClaw Gateway container');
      addLine('system', '');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSend = async () => {
    const cmd = input.trim();
    if (!cmd) return;

    addLine('input', `$ ${cmd}`);
    setInput('');
    setRunning(true);

    if (cmd.trim()) {
      setHistory((prev) => [...prev.slice(-50), cmd]);
    }
    setHistoryIdx(-1);

    // Handle cd locally
    if (cmd.startsWith('cd ')) {
      const dir = cmd.slice(3).trim();
      try {
        const result = await api.post<{ stdout: string; stderr: string; exitCode: number }>(
          '/api/proxy/openclaw/terminal/exec',
          { command: `cd ${dir} && pwd`, cwd },
        );
        if (result.exitCode === 0 && result.stdout.trim()) {
          setCwd(result.stdout.trim());
          addLine('stdout', result.stdout.trim());
        } else {
          addLine('stderr', result.stderr || 'cd failed');
        }
      } catch (err) {
        addLine('stderr', err instanceof Error ? err.message : 'Request failed');
      }
      setRunning(false);
      return;
    }

    if (cmd === 'clear') {
      setLines([]);
      lineIdRef.current = 0;
      setRunning(false);
      return;
    }

    try {
      const result = await api.post<{ stdout: string; stderr: string; exitCode: number }>(
        '/api/proxy/openclaw/terminal/exec',
        { command: cmd, cwd, timeout: 15000 },
      );

      if (result.stdout) {
        for (const line of result.stdout.split('\n')) {
          if (line) addLine('stdout', line);
        }
      }
      if (result.stderr) {
        for (const line of result.stderr.split('\n')) {
          if (line) addLine('stderr', line);
        }
      }
      if (result.exitCode !== 0) {
        addLine('system', `exit code: ${result.exitCode}`);
      }
    } catch (err) {
      addLine('stderr', err instanceof Error ? err.message : 'Request failed');
    }

    setRunning(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryIdx((prev) => {
        const next = prev + 1;
        if (next >= history.length) return prev;
        setInput(history[history.length - 1 - next]);
        return next;
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryIdx((prev) => {
        if (prev <= 0) { setInput(''); return -1; }
        const next = prev - 1;
        setInput(history[history.length - 1 - next]);
        return next;
      });
    }
  };

  const lineColor: Record<TerminalLine['type'], string> = {
    input: 'text-cyan-400',
    stdout: 'text-green-400/90',
    stderr: 'text-red-400/80',
    system: 'text-green-700/50',
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-2xl flex flex-col shadow-2xl transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ background: '#0d1117' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/30" style={{ background: '#161b22' }}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-green-500">$</span>
          <span className="font-mono text-xs text-green-400 uppercase tracking-wider">{agent.name}</span>
          <span className="font-mono text-[9px] text-green-700">{cwd}</span>
        </div>
        <div className="flex items-center gap-3">
          {running && <span className="font-mono text-[9px] text-yellow-400 animate-pulse">RUNNING</span>}
          <button onClick={onClose} className="text-green-600/60 hover:text-green-400 text-lg leading-none px-1" aria-label="Close">
            &times;
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed select-text"
        style={{ background: '#0d1117' }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div key={line.id} className={`${lineColor[line.type]} whitespace-pre-wrap break-all`}>
            {line.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-green-900/30 px-4 py-3" style={{ background: '#161b22' }}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-500 shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={running ? 'Running...' : 'Type command...'}
            className="flex-1 bg-transparent font-mono text-xs text-green-300 placeholder-green-800/40 outline-none"
            disabled={running}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="font-mono text-[8px] text-green-900/40 mt-1">
          Enter: run &middot; Up/Down: history &middot; clear: reset
        </div>
      </div>
    </div>
  );
}
