'use client';

// Updated: 2026-03-23

import type { SuggestedAction } from '@/hooks/use-chat-ws';

interface SuggestedActionsProps {
  actions: SuggestedAction[];
  onAction: (action: SuggestedAction) => void;
  disabled?: boolean;
}

const variantClasses: Record<NonNullable<SuggestedAction['variant']>, string> = {
  default:
    'border-[var(--bo-border)] text-[var(--bo-text-accent-2)] hover:bg-[var(--bo-accent-10)]',
  confirm:
    'border-green-700 text-green-400 hover:bg-green-900/20',
  danger:
    'border-red-700 text-red-400 hover:bg-red-900/20',
};

export function SuggestedActions({ actions, onAction, disabled }: SuggestedActionsProps) {
  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((action, i) => {
        const variant = action.variant ?? 'default';
        return (
          <button
            key={i}
            onClick={() => onAction(action)}
            disabled={disabled}
            className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClasses[variant]}`}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
