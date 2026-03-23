'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { handleErpCommand } from '@/lib/terminal/erp-commands';

// ── ANSI-like color helpers ────────────────────────────────────────────────

type LineColor = 'white' | 'green' | 'red' | 'yellow' | 'cyan' | 'dim';

interface OutputLine {
  id: number;
  text: string;
  color: LineColor;
  pre?: boolean; // monospace block
}

let _lineId = 0;
function line(text: string, color: LineColor = 'white', pre = false): OutputLine {
  return { id: ++_lineId, text, color, pre };
}

// ── Available system services ─────────────────────────────────────────────

const SERVICES = [
  'api-gateway', 'erp', 'dashboard', 'ai-engine', 'rag',
  'openclaw', 'workflow', 'bootstrap', 'nginx', 'kafka',
  'redis', 'postgres', 'vectordb', 'license-api',
];

// ── Command definitions ────────────────────────────────────────────────────

const COMMANDS = [
  '/status',
  '/logs',
  '/restart',
  '/kafka topics',
  '/redis info',
  '/deploy status',
  '/help',
  '/clear',
];

// ── Help text ──────────────────────────────────────────────────────────────

function buildHelp(): OutputLine[] {
  return [
    line('╔══════════════════════════════════════════════════════╗', 'cyan'),
    line('║          UniCore System Admin Terminal               ║', 'cyan'),
    line('╚══════════════════════════════════════════════════════╝', 'cyan'),
    line(''),
    line('Available commands (OWNER role required):', 'yellow'),
    line(''),
    line('  /status               Service health ASCII table', 'white'),
    line('  /logs <svc> [lines]   Stream recent container logs', 'white'),
    line('  /restart <svc>        Restart a service (with confirmation)', 'white'),
    line('  /kafka topics         List Kafka topics with counts', 'white'),
    line('  /redis info           Redis memory and connections', 'white'),
    line('  /deploy status        Last deployment info', 'white'),
    line('  /help                 Show this help', 'white'),
    line('  /clear                Clear terminal output', 'white'),
    line(''),
    line('Services: ' + SERVICES.join(', '), 'dim'),
    line(''),
  ];
}

// ── Status table builder ───────────────────────────────────────────────────

function buildStatusTable(data: any): OutputLine[] {
  const lines: OutputLine[] = [];
  const overall = data.overallStatus === 'HEALTHY' ? 'green' : 'red';

  lines.push(line(`Overall: ${data.overallStatus}`, overall));
  lines.push(line(''));
  lines.push(line('┌─────────────────────────┬────────────┬──────────┐', 'cyan'));
  lines.push(line('│ Service                 │ Status     │ Latency  │', 'cyan'));
  lines.push(line('├─────────────────────────┼────────────┼──────────┤', 'cyan'));

  for (const svc of data.services) {
    const name = svc.name.padEnd(23);
    const status = svc.status.padEnd(10);
    const latency = svc.latencyMs !== undefined ? `${svc.latencyMs}ms`.padEnd(8) : '  N/A   ';
    const color: LineColor =
      svc.status === 'HEALTHY' ? 'green' :
      svc.status === 'DEGRADED' ? 'yellow' : 'red';
    lines.push(line(`│ ${name} │ ${status} │ ${latency} │`, color));
  }

  lines.push(line('└─────────────────────────┴────────────┴──────────┘', 'cyan'));
  lines.push(line(''));

  const sys = data.system;
  if (sys) {
    lines.push(line('System:', 'yellow'));
    lines.push(line(`  Hostname:  ${sys.hostname}`, 'white'));
    lines.push(line(`  Uptime:    ${Math.floor(sys.uptimeSeconds / 3600)}h ${Math.floor((sys.uptimeSeconds % 3600) / 60)}m`, 'white'));
    lines.push(line(`  CPU Load:  ${sys.cpuPercent ?? sys.cpuLoadPercent ?? 0}% (${sys.cpuCores} cores)`, 'white'));
    lines.push(line(`  Memory:    ${sys.memoryUsedMb}MB / ${sys.memoryTotalMb}MB (${sys.memoryPercent}%)`, 'white'));
    lines.push(line(`  Checked:   ${new Date(data.checkedAt).toLocaleString()}`, 'dim'));
  }

  return lines;
}

// ── Deploy status builder ─────────────────────────────────────────────────

function buildDeployStatus(data: any): OutputLine[] {
  const lines: OutputLine[] = [];
  lines.push(line('Deployment Info:', 'yellow'));
  lines.push(line(`  Edition:    ${data.edition ?? 'N/A'}`, 'white'));
  lines.push(line(`  Version:    ${data.version ?? 'N/A'}`, 'white'));
  lines.push(line(`  Node Env:   ${data.nodeEnv ?? 'N/A'}`, 'white'));
  lines.push(line(`  Hostname:   ${data.hostname ?? 'N/A'}`, 'white'));
  lines.push(line(`  Platform:   ${data.platform ?? 'N/A'} (${data.arch ?? 'N/A'})`, 'white'));
  lines.push(line(`  Node:       ${data.nodeVersion ?? 'N/A'}`, 'white'));
  lines.push(line(`  Uptime:     ${data.uptimeSeconds ? `${Math.floor(Number(data.uptimeSeconds) / 3600)}h ${Math.floor((Number(data.uptimeSeconds) % 3600) / 60)}m` : 'N/A'}`, 'white'));
  lines.push(line(''));

  if (data.git) {
    lines.push(line('Git:', 'yellow'));
    lines.push(line(`  Commit:     ${data.git.commit}`, 'white'));
    lines.push(line(`  Branch:     ${data.git.branch}`, 'white'));
    lines.push(line(`  Built At:   ${data.git.builtAt}`, 'white'));
    lines.push(line(''));
  }

  if (data.features) {
    lines.push(line('Feature Flags:', 'yellow'));
    for (const [key, val] of Object.entries(data.features)) {
      const color: LineColor = val ? 'green' : 'dim';
      const icon = val ? '✓' : '✗';
      lines.push(line(`  ${icon} ${key}`, color));
    }
  }

  return lines;
}

// ── Redis info builder ────────────────────────────────────────────────────

function buildRedisInfo(data: any): OutputLine[] {
  const lines: OutputLine[] = [];
  lines.push(line(`Redis ${data.version} @ ${data.host}:${data.port}`, 'cyan'));
  lines.push(line(''));
  lines.push(line('Memory:', 'yellow'));
  lines.push(line(`  Used:         ${data.memory?.usedHuman ?? 'N/A'}`, 'white'));
  lines.push(line(`  Peak:         ${data.memory?.peakHuman ?? 'N/A'}`, 'white'));
  lines.push(line(`  Max:          ${data.memory?.maxmemoryHuman ?? '0B (no limit)'}`, 'white'));
  lines.push(line(''));
  lines.push(line('Connections:', 'yellow'));
  lines.push(line(`  Connected:    ${data.clients?.connected ?? 0}`, data.clients?.connected > 50 ? 'yellow' : 'green'));
  lines.push(line(`  Blocked:      ${data.clients?.blocked ?? 0}`, data.clients?.blocked > 0 ? 'yellow' : 'white'));
  lines.push(line(''));
  lines.push(line('Stats:', 'yellow'));
  if (data.stats?.opsPerSec !== undefined) {
    lines.push(line(`  Ops/sec:      ${data.stats.opsPerSec}`, 'white'));
  }
  if (data.stats?.totalCommandsProcessed !== undefined) {
    lines.push(line(`  Total cmds:   ${data.stats.totalCommandsProcessed.toLocaleString()}`, 'white'));
  }
  if (data.stats?.totalKeysExpired !== undefined) {
    lines.push(line(`  Keys expired: ${data.stats.totalKeysExpired.toLocaleString()}`, 'white'));
  }
  lines.push(line(''));
  if (data.keyspace && Object.keys(data.keyspace).length > 0) {
    lines.push(line('Keyspace:', 'yellow'));
    for (const [db, info] of Object.entries(data.keyspace)) {
      lines.push(line(`  ${db}: ${info}`, 'white'));
    }
  } else {
    lines.push(line('Keyspace: (empty)', 'dim'));
  }
  return lines;
}

// ── Kafka topics builder ──────────────────────────────────────────────────

function buildKafkaTopics(data: any): OutputLine[] {
  const lines: OutputLine[] = [];
  lines.push(line(`Kafka @ ${data.brokers}`, 'cyan'));
  lines.push(line(`Topics: ${data.topicCount}`, 'yellow'));
  lines.push(line(''));

  if (!data.topics || data.topics.length === 0) {
    lines.push(line('  (no topics found)', 'dim'));
  } else {
    for (const topic of data.topics) {
      const name = topic.name ?? topic;
      const partitions = topic.partitions !== undefined ? ` (${topic.partitions} partitions)` : '';
      lines.push(line(`  • ${name}${partitions}`, 'white'));
    }
  }

  return lines;
}

// ── Color CSS mapping ────────────────────────────────────────────────────

const COLOR_CLASS: Record<LineColor, string> = {
  white: 'text-[#c9d1d9]',
  green: 'text-[#7ee787]',
  red: 'text-[#ff7b72]',
  yellow: 'text-[#d29922]',
  cyan: 'text-[#39c5cf]',
  dim: 'text-[#484f58]',
};

// ── History storage ─────────────────────────────────────────────────────

const HISTORY_KEY = 'unicore:system-terminal:history';
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(h: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-MAX_HISTORY)));
  } catch { /* ignore */ }
}

// ── Component ────────────────────────────────────────────────────────────

export function SystemTerminal() {
  const [output, setOutput] = useState<OutputLine[]>(() => buildHelp());
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [histIdx, setHistIdx] = useState(-1);
  const [savedInput, setSavedInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggIdx, setSuggIdx] = useState(-1);
  const [confirmRestart, setConfirmRestart] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new output
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const push = useCallback((...lines: OutputLine[]) => {
    setOutput(prev => [...prev, ...lines]);
  }, []);

  const pushError = useCallback((msg: string) => {
    push(line(`✗ Error: ${msg}`, 'red'));
    push(line(''));
  }, [push]);

  const addToHistory = useCallback((cmd: string) => {
    const next = [...history, cmd].slice(-MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    setHistIdx(-1);
    setSavedInput('');
  }, [history]);

  // ── Command executor ────────────────────────────────────────────────────

  const runCommand = useCallback(async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;

    addToHistory(cmd);
    push(line(`unicore> ${cmd}`, 'dim'));

    const parts = cmd.split(/\s+/);
    const verb = parts[0].toLowerCase();

    if (verb === '/clear') {
      setOutput([]);
      return;
    }

    if (verb === '/help') {
      push(...buildHelp());
      return;
    }

    if (verb === '/status') {
      setRunning(true);
      push(line('Checking service health…', 'dim'));
      try {
        const data = await api.get<any>('/api/v1/admin/system/status');
        push(...buildStatusTable(data));
      } catch (err: any) {
        pushError(err?.message ?? 'Failed to fetch status');
      } finally {
        setRunning(false);
      }
      return;
    }

    if (verb === '/logs') {
      const service = parts[1];
      const lines = parts[2] ? parseInt(parts[2]) : 100;

      if (!service) {
        push(line('Usage: /logs <service> [lines]', 'yellow'));
        push(line('Services: ' + SERVICES.join(', '), 'dim'));
        push(line(''));
        return;
      }

      setRunning(true);
      push(line(`Fetching last ${isNaN(lines) ? 100 : lines} lines from ${service}…`, 'dim'));
      try {
        const data = await api.get<any>(
          `/api/v1/admin/system/logs?service=${encodeURIComponent(service)}&lines=${isNaN(lines) ? 100 : lines}`,
        );
        const logLines = (data.output as string).split('\n');
        push(line(`── ${data.container} (${logLines.length} lines) ──`, 'cyan'));
        for (const l of logLines) {
          const color: LineColor =
            /error|fail|fatal|exception/i.test(l) ? 'red' :
            /warn/i.test(l) ? 'yellow' :
            /info|start|ready/i.test(l) ? 'green' : 'white';
          push({ id: ++_lineId, text: l, color, pre: true });
        }
        push(line(''));
      } catch (err: any) {
        pushError(err?.message ?? `Failed to fetch logs for ${service}`);
      } finally {
        setRunning(false);
      }
      return;
    }

    if (verb === '/restart') {
      const service = parts[1];
      if (!service) {
        push(line('Usage: /restart <service>', 'yellow'));
        push(line('Services: ' + SERVICES.join(', '), 'dim'));
        push(line(''));
        return;
      }
      // Defer — confirmation dialog handled by the confirm button
      setConfirmRestart(service);
      return;
    }

    if (verb === '/kafka' && parts[1]?.toLowerCase() === 'topics') {
      setRunning(true);
      push(line('Listing Kafka topics…', 'dim'));
      try {
        const data = await api.get<any>('/api/v1/admin/system/kafka/topics');
        push(...buildKafkaTopics(data));
        push(line(''));
      } catch (err: any) {
        pushError(err?.message ?? 'Failed to list Kafka topics');
      } finally {
        setRunning(false);
      }
      return;
    }

    if (verb === '/redis' && parts[1]?.toLowerCase() === 'info') {
      setRunning(true);
      push(line('Connecting to Redis…', 'dim'));
      try {
        const data = await api.get<any>('/api/v1/admin/system/redis/info');
        push(...buildRedisInfo(data));
        push(line(''));
      } catch (err: any) {
        pushError(err?.message ?? 'Failed to fetch Redis info');
      } finally {
        setRunning(false);
      }
      return;
    }

    if (verb === '/deploy' && parts[1]?.toLowerCase() === 'status') {
      setRunning(true);
      push(line('Fetching deployment info…', 'dim'));
      try {
        const data = await api.get<any>('/api/v1/admin/system/deploy/status');
        push(...buildDeployStatus(data));
        push(line(''));
      } catch (err: any) {
        pushError(err?.message ?? 'Failed to fetch deploy status');
      } finally {
        setRunning(false);
      }
      return;
    }

    // Unknown command
    push(line(`Unknown command: ${cmd}`, 'red'));
    push(line('Type /help for available commands.', 'dim'));
    push(line(''));
  }, [addToHistory, push, pushError]);

  // ── Confirm restart ───────────────────────────────────────────────────

  const doRestart = useCallback(async (service: string) => {
    setConfirmRestart(null);
    setRunning(true);
    push(line(`Restarting ${service}…`, 'yellow'));
    try {
      await api.post<any>('/api/v1/admin/system/restart', { service });
      push(line(`✓ ${service} restarted successfully`, 'green'));
    } catch (err: any) {
      pushError(err?.message ?? `Failed to restart ${service}`);
    } finally {
      setRunning(false);
      push(line(''));
    }
  }, [push, pushError]);

  // ── Autocomplete ──────────────────────────────────────────────────────

  const computeSuggestions = (val: string): string[] => {
    const trimmed = val.trimStart();
    if (!trimmed.startsWith('/')) return [];
    return COMMANDS.filter(c => c.startsWith(trimmed.toLowerCase())).slice(0, 6);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    setHistIdx(-1);
    const s = computeSuggestions(val);
    setSuggestions(s);
    setSuggIdx(-1);
  };

  // ── Keyboard handling ─────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      if (suggestions.length === 1) {
        setInput(suggestions[0] + ' ');
        setSuggestions([]);
        return;
      }
      const next = (suggIdx + 1) % suggestions.length;
      setSuggIdx(next);
      return;
    }

    if (e.key === 'Enter') {
      if (suggestions.length > 0 && suggIdx >= 0) {
        e.preventDefault();
        setInput(suggestions[suggIdx] + ' ');
        setSuggestions([]);
        setSuggIdx(-1);
        return;
      }
      e.preventDefault();
      const val = input.trim();
      if (!val || running) return;
      setInput('');
      setSuggestions([]);
      setSuggIdx(-1);
      runCommand(val);
      return;
    }

    if (e.key === 'Escape') {
      setSuggestions([]);
      setSuggIdx(-1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const prev = suggIdx <= 0 ? suggestions.length - 1 : suggIdx - 1;
        setSuggIdx(prev);
        return;
      }
      if (history.length === 0) return;
      const newIdx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      if (histIdx === -1) setSavedInput(input);
      setHistIdx(newIdx);
      setInput(history[newIdx]);
      setSuggestions([]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const next = (suggIdx + 1) % suggestions.length;
        setSuggIdx(next);
        return;
      }
      if (histIdx === -1) return;
      if (histIdx === history.length - 1) {
        setHistIdx(-1);
        setInput(savedInput);
        return;
      }
      const newIdx = histIdx + 1;
      setHistIdx(newIdx);
      setInput(history[newIdx]);
      setSuggestions([]);
      return;
    }
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg overflow-hidden border border-[#30363d]"
      style={{ background: '#0d1117', fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-[#21262d] shrink-0"
        style={{ background: '#161b22' }}
      >
        <span className="text-xs text-[#39c5cf]">$</span>
        <span className="text-xs text-[#39c5cf] font-bold uppercase tracking-wider">
          System Admin Terminal
        </span>
        <span className="ml-auto text-[10px] text-[#484f58] uppercase">
          {running ? (
            <span className="text-[#d29922] animate-pulse">running…</span>
          ) : (
            'OWNER only'
          )}
        </span>
      </div>

      {/* Output area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 min-h-0">
        {output.map((l) => (
          <div
            key={l.id}
            className={`text-xs leading-5 ${COLOR_CLASS[l.color]} ${l.pre ? 'whitespace-pre' : 'whitespace-pre-wrap'}`}
          >
            {l.text || '\u00A0'}
          </div>
        ))}
      </div>

      {/* Confirm restart banner */}
      {confirmRestart && (
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-2 border-t border-[#d29922]/30 text-xs"
          style={{ background: '#1a1400' }}
        >
          <span className="text-[#d29922]">
            ⚠ Restart <strong>{confirmRestart}</strong>? This will briefly interrupt service.
          </span>
          <button
            onClick={() => doRestart(confirmRestart)}
            className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 text-xs font-bold"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setConfirmRestart(null);
              push(line(`Restart of ${confirmRestart} cancelled.`, 'dim'));
              push(line(''));
            }}
            className="px-3 py-1 rounded border border-[#484f58] text-[#c9d1d9] hover:border-[#c9d1d9] text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-[#21262d] px-4 py-2" style={{ background: '#161b22' }}>
        {/* Autocomplete */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {suggestions.map((s, i) => (
              <button
                key={s}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setInput(s + ' ');
                  setSuggestions([]);
                  setSuggIdx(-1);
                  inputRef.current?.focus();
                }}
                className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                  i === suggIdx
                    ? 'bg-[#39c5cf]/20 border-[#39c5cf] text-[#39c5cf]'
                    : 'border-[#30363d] text-[#484f58] hover:border-[#8b949e] hover:text-[#c9d1d9]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[#7ee787] text-xs shrink-0">unicore&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={running ? 'Running…' : 'Type /help for commands…'}
            className="flex-1 bg-transparent text-[#c9d1d9] text-xs outline-none placeholder:text-[#484f58] disabled:opacity-40"
          />
        </div>
      </div>
    </div>
  );
}
