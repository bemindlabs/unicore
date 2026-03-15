'use client';

import type { BoardTask } from '@/lib/tasks/types';
import { PRIORITY_CONFIG } from '@/lib/tasks/types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PRIORITY_ICONS: Record<string, string> = {
  critical: '♥',
  high: '★',
  medium: '✿',
  low: '☁',
};

interface Props {
  task: BoardTask;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ChinjanTaskCard({ task, onClick, onDragStart }: Props) {
  const priorityCfg = PRIORITY_CONFIG[task.priority];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(e);
      }}
      onClick={onClick}
      className="border-2 p-3 cursor-pointer hover:shadow-md transition-all group"
      style={{
        borderColor: 'var(--chinjan-border)',
        background: 'var(--chinjan-surface)',
      }}
    >
      {/* Priority + Labels */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="chinjan-mono text-base" style={{ color: priorityCfg.color }}>
          {PRIORITY_ICONS[task.priority]}
        </span>
        <span className="chinjan-mono text-xs" style={{ color: priorityCfg.color }}>
          {priorityCfg.label}
        </span>
        {task.labels.slice(0, 2).map((label: string) => (
          <span key={label} className="chinjan-mono text-[10px] px-1 border" style={{ borderColor: 'var(--chinjan-border)', color: 'var(--chinjan-muted)' }}>
            {label}
          </span>
        ))}
      </div>

      {/* Title */}
      <h4
        className="chinjan-mono text-sm leading-snug mb-2 line-clamp-2"
        style={{ color: 'var(--chinjan-text)' }}
      >
        {task.title}
      </h4>

      {/* Progress bar (pixel style) */}
      {task.progress > 0 && task.status !== 'done' && (
        <div className="w-full h-2 mb-2" style={{ background: 'var(--chinjan-border)' }}>
          <div
            className="h-full transition-all"
            style={{ width: `${task.progress}%`, background: 'var(--chinjan-pink)' }}
          />
        </div>
      )}

      {task.status === 'done' && (
        <div className="chinjan-mono text-xs mb-1" style={{ color: 'var(--chinjan-green)' }}>
          ★ Complete!
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3" style={{ background: task.assignee.color ?? 'var(--chinjan-blue)' }} />
            <span className="chinjan-mono text-[10px]" style={{ color: 'var(--chinjan-text)' }}>
              {task.assignee.name}
            </span>
          </div>
        ) : (
          <span className="chinjan-mono text-[10px]" style={{ color: 'var(--chinjan-muted)' }}>
            Unassigned
          </span>
        )}
        <span className="chinjan-mono text-[10px]" style={{ color: 'var(--chinjan-muted)' }}>
          {relativeTime(task.updatedAt)}
        </span>
      </div>
    </div>
  );
}
