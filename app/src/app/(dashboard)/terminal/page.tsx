'use client';

import { useRef, useState, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { CommandInput } from '@/components/terminal/command-input';
import { handleErpCommand } from '@/lib/terminal/erp-commands';

// ── Types ────────────────────────────────────────────────────────────────────

interface OutputLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const HELP_TEXT = `UniCore Terminal — available commands:
  /erp contacts [search]     — list contacts
  /erp orders [status]       — list orders
  /erp inventory             — stock levels with low-stock flags
  /erp revenue [period]      — revenue summary
  /erp invoice <id>          — invoice detail by ID
  /erp report pnl            — P&L monthly report
  help                       — show this message
  clear                      — clear terminal`;

let idCounter = 0;
function nextId() {
  return ++idCounter;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TerminalPage() {
  const [lines, setLines] = useState<OutputLine[]>([
    { id: nextId(), type: 'info', text: 'UniCore Terminal  —  type "help" for available commands' },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const appendLines = useCallback((newLines: OutputLine[]) => {
    setLines((prev) => {
      const next = [...prev, ...newLines];
      // Keep last 500 lines
      return next.length > 500 ? next.slice(next.length - 500) : next;
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  }, []);

  const handleCommand = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Echo input
      appendLines([{ id: nextId(), type: 'input', text: `> ${trimmed}` }]);

      const lower = trimmed.toLowerCase();

      // Built-in: clear
      if (lower === 'clear') {
        setLines([]);
        return;
      }

      // Built-in: help
      if (lower === 'help') {
        appendLines([{ id: nextId(), type: 'info', text: HELP_TEXT }]);
        return;
      }

      // /erp command
      const isErp = lower.startsWith('/erp') || lower.startsWith('erp ');
      if (isErp) {
        const withoutSlash = trimmed.replace(/^\/?erp\s*/i, '');
        const args = withoutSlash.trim().split(/\s+/).filter(Boolean);

        setBusy(true);
        try {
          const output = await handleErpCommand(args);
          appendLines([{ id: nextId(), type: 'output', text: output }]);
        } catch (err) {
          appendLines([
            {
              id: nextId(),
              type: 'error',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ]);
        } finally {
          setBusy(false);
        }
        return;
      }

      appendLines([
        {
          id: nextId(),
          type: 'error',
          text: `Unknown command: "${trimmed}". Type "help" for available commands.`,
        },
      ]);
    },
    [appendLines]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Terminal className="h-5 w-5 text-green-500" />
        <h1 className="text-base font-semibold">Terminal</h1>
        <span className="text-xs text-muted-foreground ml-1">ERP quick-access commands</span>
        {busy && (
          <span className="ml-auto text-xs text-yellow-500 animate-pulse font-mono">running…</span>
        )}
      </div>

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
        style={{ background: 'var(--background)' }}
      >
        {lines.map((line) => (
          <pre
            key={line.id}
            className={
              'whitespace-pre-wrap break-words leading-5 ' +
              (line.type === 'input'
                ? 'text-green-400 mt-2'
                : line.type === 'error'
                  ? 'text-red-400'
                  : line.type === 'info'
                    ? 'text-muted-foreground'
                    : 'text-foreground')
            }
          >
            {line.text}
          </pre>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t px-4 py-3">
        <CommandInput onSubmit={handleCommand} disabled={busy} />
      </div>
    </div>
  );
}
