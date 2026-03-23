'use client';

// Updated: 2026-03-23

import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ToolCallEntry } from '@/hooks/use-chat-ws';

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
}

function StatusIcon({ status }: { status: ToolCallEntry['status'] }) {
  if (status === 'success') return <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />;
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />;
  return <Loader2 className="h-3.5 w-3.5 text-[var(--bo-text-muted)] flex-shrink-0 animate-spin" />;
}

function JsonTree({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--bo-text-dim)]">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className={value ? 'text-green-400' : 'text-red-400'}>{String(value)}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-blue-400">{value}</span>;
  }
  if (typeof value === 'string') {
    if (value.length > 200) {
      return <span className="text-yellow-300 break-all">&quot;{value.slice(0, 200)}&hellip;&quot;</span>;
    }
    return <span className="text-yellow-300 break-all">&quot;{value}&quot;</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[var(--bo-text-muted)]">[]</span>;
    return (
      <span>
        [{value.slice(0, 5).map((v, i) => (
          <span key={i}>{i > 0 && ', '}<JsonTree value={v} /></span>
        ))}{value.length > 5 && <span className="text-[var(--bo-text-muted)]">, …+{value.length - 5}</span>}]
      </span>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 8);
    const overflow = Object.keys(value as Record<string, unknown>).length - 8;
    return (
      <span>
        {'{'}
        {entries.map(([k, v], i) => (
          <span key={k}>{i > 0 && ', '}<span className="text-[var(--bo-text-accent)]">{k}</span>: <JsonTree value={v} /></span>
        ))}
        {overflow > 0 && <span className="text-[var(--bo-text-muted)]">, …+{overflow}</span>}
        {'}'}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const hasParams = toolCall.arguments && Object.keys(toolCall.arguments).length > 0;
  const hasResult = toolCall.result !== undefined || toolCall.error !== undefined;

  return (
    <div className="mt-1.5 rounded-md border border-[var(--bo-border)] bg-[var(--bo-bg)] overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bo-bg-elevated)]">
        <Wrench className="h-3 w-3 text-[var(--bo-text-accent)] flex-shrink-0" />
        <span className="font-semibold text-[var(--bo-text-accent-2)] flex-1 truncate">{toolCall.toolName}</span>
        <StatusIcon status={toolCall.status} />
      </div>

      {/* Params */}
      {hasParams && (
        <div className="border-t border-[var(--bo-border)]">
          <button
            onClick={() => setParamsOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full px-2.5 py-1 text-[var(--bo-text-muted)] hover:bg-[var(--bo-accent-5)] transition-colors"
          >
            {paramsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span>params</span>
          </button>
          {paramsOpen && (
            <div className="px-3 py-2 bg-[var(--bo-bg)] border-t border-[var(--bo-border)] text-[10px] leading-relaxed text-[var(--bo-text-body-soft)] overflow-x-auto">
              <JsonTree value={toolCall.arguments} />
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {hasResult && (
        <div className="border-t border-[var(--bo-border)]">
          <button
            onClick={() => setResultOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full px-2.5 py-1 text-[var(--bo-text-muted)] hover:bg-[var(--bo-accent-5)] transition-colors"
          >
            {resultOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className={toolCall.error ? 'text-red-400' : ''}>
              {toolCall.error ? 'error' : 'result'}
            </span>
          </button>
          {resultOpen && (
            <div className={`px-3 py-2 border-t border-[var(--bo-border)] text-[10px] leading-relaxed overflow-x-auto ${
              toolCall.error ? 'text-red-400 bg-red-950/20' : 'text-[var(--bo-text-body-soft)] bg-[var(--bo-bg)]'
            }`}>
              {toolCall.error
                ? <span className="break-all">{toolCall.error}</span>
                : <JsonTree value={toolCall.result} />
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
