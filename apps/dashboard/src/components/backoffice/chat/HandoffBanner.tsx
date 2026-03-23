'use client';

import { AlertTriangle, Bot, CheckCircle, Clock, UserCheck, X } from 'lucide-react';
import type { Handoff } from '@/hooks/use-handoff';

interface HandoffBannerProps {
  handoff: Handoff;
  slaSecondsRemaining: number | null;
  onClaim: () => void;
  onResolve: () => void;
  onResumeAI: () => void;
  onDismiss?: () => void;
  loading?: boolean;
}

function formatSla(seconds: number): string {
  if (seconds <= 0) return 'SLA expired';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case 'low_confidence': return 'Low AI confidence';
    case 'explicit_request': return 'User requested human';
    case 'user_request': return 'User request';
    default: return 'Escalated';
  }
}

/**
 * HandoffBanner
 *
 * Displayed inside ChatBox when an active handoff is detected.
 * Shows SLA countdown, context summary, and action buttons.
 */
export function HandoffBanner({
  handoff,
  slaSecondsRemaining,
  onClaim,
  onResolve,
  onResumeAI,
  onDismiss,
  loading,
}: HandoffBannerProps) {
  const isResolved =
    handoff.status === 'resolved' || handoff.status === 'ai_resumed';
  const slaExpired = slaSecondsRemaining !== null && slaSecondsRemaining <= 0;
  const slaCritical = slaSecondsRemaining !== null && slaSecondsRemaining <= 120; // < 2 min

  if (isResolved) {
    return (
      <div className="mx-3 mt-2 mb-1 rounded-lg border border-[var(--bo-border)] bg-[var(--bo-bg-elevated)] px-3 py-2 flex items-center gap-2 text-xs font-mono text-[var(--bo-text-muted)]">
        {handoff.status === 'ai_resumed' ? (
          <>
            <Bot className="h-3.5 w-3.5 text-[var(--bo-text-accent)]" />
            <span>AI resumed handling this conversation.</span>
          </>
        ) : (
          <>
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            <span>Handoff resolved.</span>
          </>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto p-0.5 hover:bg-[var(--bo-accent-10)] rounded"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mx-3 mt-2 mb-1 rounded-lg border px-3 py-2.5 text-xs font-mono space-y-2 ${
        slaExpired
          ? 'border-red-500/60 bg-red-950/20'
          : slaCritical
            ? 'border-amber-500/60 bg-amber-950/20'
            : 'border-[var(--bo-border-accent)] bg-[var(--bo-bg-elevated)]'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <AlertTriangle
          className={`h-3.5 w-3.5 flex-shrink-0 ${
            slaExpired ? 'text-red-400' : slaCritical ? 'text-amber-400' : 'text-[var(--bo-text-accent)]'
          }`}
        />
        <span className="font-semibold text-[var(--bo-text-body)]">Human handoff requested</span>
        <span className="px-1.5 py-0.5 rounded bg-[var(--bo-accent-10)] text-[var(--bo-text-muted)] text-[10px]">
          {triggerLabel(handoff.trigger)}
        </span>
        {handoff.status === 'active' && handoff.assignedTo && (
          <span className="ml-auto flex items-center gap-1 text-[var(--bo-text-muted)]">
            <UserCheck className="h-3 w-3" />
            <span>Claimed</span>
          </span>
        )}
      </div>

      {/* SLA timer */}
      <div className="flex items-center gap-1.5">
        <Clock
          className={`h-3 w-3 flex-shrink-0 ${
            slaExpired ? 'text-red-400' : slaCritical ? 'text-amber-400' : 'text-[var(--bo-text-muted)]'
          }`}
        />
        <span
          className={`font-mono tabular-nums ${
            slaExpired
              ? 'text-red-400 font-semibold'
              : slaCritical
                ? 'text-amber-400'
                : 'text-[var(--bo-text-muted)]'
          }`}
        >
          SLA:{' '}
          {slaSecondsRemaining !== null
            ? formatSla(slaSecondsRemaining)
            : new Date(handoff.slaDeadline).toLocaleTimeString()}
        </span>
        {handoff.slaBreached && (
          <span className="px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 text-[10px] font-semibold">
            BREACHED
          </span>
        )}
      </div>

      {/* Context summary */}
      {handoff.contextSummary && (
        <div className="rounded border border-[var(--bo-border)] bg-[var(--bo-bg)] px-2 py-1.5 text-[var(--bo-text-body-soft)] max-h-20 overflow-y-auto whitespace-pre-wrap text-[11px]">
          {handoff.contextSummary}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {handoff.status === 'pending' && (
          <button
            onClick={onClaim}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--bo-border-accent)] bg-[var(--bo-accent-15)] text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-25)] disabled:opacity-50 transition-colors text-[11px] font-semibold"
          >
            <UserCheck className="h-3 w-3" />
            Claim
          </button>
        )}

        <button
          onClick={onResumeAI}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--bo-border)] bg-[var(--bo-bg)] text-[var(--bo-text-accent-2)] hover:bg-[var(--bo-accent-10)] disabled:opacity-50 transition-colors text-[11px]"
        >
          <Bot className="h-3 w-3" />
          Let AI Handle
        </button>

        {handoff.status === 'active' && (
          <button
            onClick={onResolve}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-green-700/50 bg-green-900/20 text-green-400 hover:bg-green-900/40 disabled:opacity-50 transition-colors text-[11px]"
          >
            <CheckCircle className="h-3 w-3" />
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}
