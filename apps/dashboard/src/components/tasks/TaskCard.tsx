'use client';

import type { BoardTask } from '@/lib/tasks/types';
import { PRIORITY_CONFIG } from '@/lib/tasks/types';
const RetroDeskOnly = ({ children }: { children: React.ReactNode }) => null;
const DefaultOnly = ({ children }: { children: React.ReactNode }) => <>{children}</>;

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

interface Props {
  task: BoardTask;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function TaskCard({ task, onClick, onDragStart }: Props): JSX.Element {
  const priorityCfg = PRIORITY_CONFIG[task.priority];

  return (
    <>
    <DefaultOnly>
    <div
      draggable
      role="button"
      aria-label={task.title}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(e);
      }}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
    >
      {/* Priority + Labels */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{ background: `${priorityCfg.color}20`, color: priorityCfg.color }}
        >
          {priorityCfg.label}
        </span>
        {task.labels.slice(0, 2).map((label: string) => (
          <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary-foreground">
            {label}
          </span>
        ))}
        {task.labels.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{task.labels.length - 2}</span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {task.title}
      </h4>

      {/* Progress bar */}
      {task.progress > 0 && task.status !== 'done' && (
        <div role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Task progress" className="w-full h-1.5 bg-muted rounded-full mb-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${task.progress}%`, background: priorityCfg.color }}
          />
        </div>
      )}

      {/* Footer: assignee + timestamp */}
      <div className="flex items-center justify-between">
        {task.assignee ? (
          <div className="flex items-center gap-1.5">
            {task.assignee.type === 'agent' && task.assignee.color ? (
              <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: task.assignee.color }} />
            ) : (
              <span className="w-4 h-4 rounded-full flex-shrink-0 bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold">
                {task.assignee.name.charAt(0)}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">{task.assignee.name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
        )}
        <div className="flex items-center gap-2">
          {task.comments.length > 0 && (
            <span className="text-[10px] text-muted-foreground">💬 {task.comments.length}</span>
          )}
          <span className="text-[10px] text-muted-foreground">{relativeTime(task.updatedAt)}</span>
        </div>
      </div>
    </div>
    </DefaultOnly>
    </>
  );
}
