'use client';

import type { TaskActivityEntry } from '@/lib/tasks/types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const ACTION_LABELS: Record<string, string> = {
  created: 'created this task',
  status_changed: 'changed status',
  assigned: 'updated assignment',
  commented: 'added a comment',
  progress_updated: 'updated progress',
  completed: 'marked as complete',
  failed: 'marked as failed',
};

function ActionIcon({ action }: { action: string }) {
  const icons: Record<string, string> = {
    created: '◆',
    status_changed: '→',
    assigned: '◎',
    commented: '💬',
    progress_updated: '▲',
    completed: '✓',
    failed: '✕',
  };
  const colors: Record<string, string> = {
    created: '#6366f1',
    status_changed: '#f59e0b',
    assigned: '#8b5cf6',
    commented: '#3b82f6',
    progress_updated: '#06b6d4',
    completed: '#10b981',
    failed: '#ef4444',
  };
  return (
    <span
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full"
      style={{ background: `${colors[action] ?? '#6b7280'}20`, color: colors[action] ?? '#6b7280' }}
    >
      {icons[action] ?? '•'}
    </span>
  );
}

export function ActivityFeed({ entries, maxItems }: { entries: TaskActivityEntry[]; maxItems?: number }): JSX.Element {
  const sorted = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const items = maxItems ? sorted.slice(0, maxItems) : sorted;

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2">
          <ActionIcon action={entry.action} />
          <div className="flex-1 min-w-0">
            <p className="text-xs">
              <span className="font-medium">{entry.actorName}</span>
              <span className="text-muted-foreground"> {ACTION_LABELS[entry.action] ?? entry.action}</span>
            </p>
            {entry.detail && (
              <p className="text-[10px] text-muted-foreground font-mono">{entry.detail}</p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {relativeTime(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
