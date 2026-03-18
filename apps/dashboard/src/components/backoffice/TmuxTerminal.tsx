'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface TmuxSession {
  name: string;
  windows: number;
  created: number;
  lastActivity: number;
}

interface SessionDetail {
  name: string;
  windows: number;
  panes: number;
  output: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const POLL_INTERVAL_MS = 2000;

const QUICK_ACTIONS = [
  { label: 'Run Claude', command: 'claude' },
  { label: 'Run Gemini', command: 'gemini' },
  { label: 'Run Codex', command: 'codex' },
];

export function TmuxTerminal({ open, onClose }: Props) {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [command, setCommand] = useState('');
  const [creating, setCreating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.get<TmuxSession[]>('/api/proxy/openclaw/terminal/tmux/sessions');
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      // silently ignore poll errors
    }
  }, []);

  const fetchDetail = useCallback(async (name: string) => {
    try {
      const data = await api.get<{ ok: boolean } & SessionDetail>(
        `/api/proxy/openclaw/terminal/tmux/session/${encodeURIComponent(name)}`,
      );
      if (data.ok) setSessionDetail(data);
    } catch {
      // silently ignore
    }
  }, []);

  // Poll sessions list
  useEffect(() => {
    if (!open) return;
    fetchSessions();
    const id = setInterval(fetchSessions, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [open, fetchSessions]);

  // Poll active session output
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!open || !activeSession) return;
    fetchDetail(activeSession);
    pollRef.current = setInterval(() => fetchDetail(activeSession), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, activeSession, fetchDetail]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [sessionDetail?.output]);

  const createSession = async () => {
    const name = newSessionName.trim() || `session-${Date.now()}`;
    setCreating(true);
    try {
      const result = await api.post<{ ok: boolean; error?: string }>(
        '/api/proxy/openclaw/terminal/tmux/session',
        { name },
      );
      if (result.ok) {
        setNewSessionName('');
        setActiveSession(name);
        await fetchSessions();
      }
    } finally {
      setCreating(false);
    }
  };

  const killSession = async (name: string) => {
    await api.delete(`/api/proxy/openclaw/terminal/tmux/session/${encodeURIComponent(name)}`);
    if (activeSession === name) {
      setActiveSession(null);
      setSessionDetail(null);
    }
    await fetchSessions();
  };

  const execCommand = async (cmd?: string) => {
    const target = cmd ?? command.trim();
    if (!target || !activeSession) return;
    setExecuting(true);
    setCommand('');
    try {
      const result = await api.post<{ ok: boolean; output?: string; error?: string }>(
        `/api/proxy/openclaw/terminal/tmux/session/${encodeURIComponent(activeSession)}/exec`,
        { command: target },
      );
      if (result.ok && result.output !== undefined) {
        setSessionDetail((prev) => prev ? { ...prev, output: result.output! } : prev);
      }
    } finally {
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const splitPane = async (direction: 'h' | 'v') => {
    if (!activeSession) return;
    await api.post(`/api/proxy/openclaw/terminal/tmux/session/${encodeURIComponent(activeSession)}/split`, { direction });
    await fetchDetail(activeSession);
  };

  const newWindow = async () => {
    if (!activeSession) return;
    await api.post(`/api/proxy/openclaw/terminal/tmux/session/${encodeURIComponent(activeSession)}/window`, {});
    await fetchDetail(activeSession);
  };

  const formatAge = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative m-auto flex w-full max-w-5xl h-[85vh] rounded-lg overflow-hidden shadow-2xl border border-green-900/40"
        style={{ background: '#0d1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar — session list */}
        <div className="w-52 shrink-0 flex flex-col border-r border-green-900/30" style={{ background: '#161b22' }}>
          <div className="px-3 py-2.5 border-b border-green-900/30 flex items-center justify-between">
            <span className="font-mono text-[10px] text-green-500 uppercase tracking-widest">tmux</span>
            <span className="font-mono text-[9px] text-green-800">persistent</span>
          </div>

          {/* New session */}
          <div className="px-2 py-2 border-b border-green-900/20">
            <div className="flex gap-1">
              <input
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createSession()}
                placeholder="session name"
                className="flex-1 min-w-0 bg-black/40 font-mono text-[10px] text-green-300 placeholder-green-900/50 px-2 py-1 rounded border border-green-900/30 outline-none focus:border-green-700/50"
              />
              <button
                onClick={createSession}
                disabled={creating}
                className="font-mono text-[10px] text-green-400 hover:text-green-200 px-2 py-1 rounded border border-green-800/40 hover:border-green-600/60 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto py-1">
            {sessions.length === 0 && (
              <p className="font-mono text-[9px] text-green-900/50 px-3 py-2">No sessions</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.name}
                className={`group flex items-center justify-between px-3 py-1.5 cursor-pointer ${
                  activeSession === s.name
                    ? 'bg-green-900/20 border-l-2 border-green-500'
                    : 'hover:bg-green-900/10 border-l-2 border-transparent'
                }`}
                onClick={() => setActiveSession(s.name)}
              >
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-green-400 truncate">{s.name}</div>
                  <div className="font-mono text-[8px] text-green-800">{s.windows}w · {formatAge(s.lastActivity)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); killSession(s.name); }}
                  className="opacity-0 group-hover:opacity-100 font-mono text-[10px] text-red-600/70 hover:text-red-400 ml-1 shrink-0"
                  title="Kill session"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Keyboard hints */}
          <div className="px-3 py-2 border-t border-green-900/20">
            <p className="font-mono text-[8px] text-green-900/50 leading-relaxed">
              Sessions survive disconnects<br />
              Ctrl+b d: detach<br />
              Ctrl+b [: scroll mode
            </p>
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-green-900/30 shrink-0" style={{ background: '#161b22' }}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-green-400">
                {activeSession ? `[${activeSession}]` : 'No session selected'}
              </span>
              {sessionDetail && (
                <span className="font-mono text-[9px] text-green-800">
                  {sessionDetail.windows}w · {sessionDetail.panes} panes
                </span>
              )}
              {activeSession && (
                <span className="font-mono text-[9px] text-green-600/60 border border-green-900/40 px-1 rounded">
                  PERSISTENT
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeSession && (
                <>
                  <button
                    onClick={() => splitPane('h')}
                    title="Split horizontal"
                    className="font-mono text-[9px] text-green-700 hover:text-green-400 border border-green-900/40 hover:border-green-700/50 px-1.5 py-0.5 rounded"
                  >
                    ⊞h
                  </button>
                  <button
                    onClick={() => splitPane('v')}
                    title="Split vertical"
                    className="font-mono text-[9px] text-green-700 hover:text-green-400 border border-green-900/40 hover:border-green-700/50 px-1.5 py-0.5 rounded"
                  >
                    ⊞v
                  </button>
                  <button
                    onClick={newWindow}
                    title="New window"
                    className="font-mono text-[9px] text-green-700 hover:text-green-400 border border-green-900/40 hover:border-green-700/50 px-1.5 py-0.5 rounded"
                  >
                    +win
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="text-green-700 hover:text-green-400 text-lg leading-none px-1 ml-1"
              >
                ×
              </button>
            </div>
          </div>

          {activeSession ? (
            <>
              {/* Quick actions */}
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-green-900/20 shrink-0" style={{ background: '#0f1419' }}>
                <span className="font-mono text-[8px] text-green-800 mr-1">quick:</span>
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    onClick={() => execCommand(a.command)}
                    disabled={executing}
                    className="font-mono text-[9px] text-green-600 hover:text-green-300 border border-green-900/40 hover:border-green-700/50 px-2 py-0.5 rounded disabled:opacity-40"
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Output */}
              <pre
                ref={outputRef}
                className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs text-green-400/90 leading-relaxed whitespace-pre-wrap break-all select-text"
                style={{ background: '#0d1117' }}
              >
                {sessionDetail?.output || <span className="text-green-900/40">— waiting for output —</span>}
              </pre>

              {/* Input */}
              <div className="border-t border-green-900/30 px-4 py-3 shrink-0" style={{ background: '#161b22' }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-green-500 shrink-0">$</span>
                  <input
                    ref={inputRef}
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); execCommand(); } }}
                    placeholder={executing ? 'Running…' : 'Send command to tmux session…'}
                    disabled={executing}
                    autoComplete="off"
                    spellCheck={false}
                    className="flex-1 bg-transparent font-mono text-xs text-green-300 placeholder-green-800/40 outline-none"
                  />
                  {executing && <span className="font-mono text-[9px] text-yellow-400 animate-pulse">RUNNING</span>}
                </div>
                <div className="font-mono text-[8px] text-green-900/40 mt-1">
                  Enter: send · output polls every 2s · session persists after close
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="font-mono text-sm text-green-700">No session selected</p>
                <p className="font-mono text-xs text-green-900/60 mt-1">Create or select a session from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
