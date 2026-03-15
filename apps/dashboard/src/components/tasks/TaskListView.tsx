'use client';

import { useState } from 'react';
import type { BoardTask } from '@/lib/tasks/types';
import { KANBAN_COLUMNS, PRIORITY_CONFIG } from '@/lib/tasks/types';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

type SortKey = 'title' | 'status' | 'priority' | 'updatedAt';

interface Props {
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
}

export function TaskListView({ tasks, onTaskClick }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'status': {
        const order = KANBAN_COLUMNS.map((c) => c.key);
        cmp = order.indexOf(a.status) - order.indexOf(b.status);
        break;
      }
      case 'priority':
        cmp = (PRIORITY_CONFIG[a.priority]?.order ?? 9) - (PRIORITY_CONFIG[b.priority]?.order ?? 9);
        break;
      case 'updatedAt':
        cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '');

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-4 py-2 text-xs font-medium cursor-pointer hover:text-primary" onClick={() => handleSort('title')}>
              Title{arrow('title')}
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium cursor-pointer hover:text-primary w-28" onClick={() => handleSort('status')}>
              Status{arrow('status')}
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium cursor-pointer hover:text-primary w-24" onClick={() => handleSort('priority')}>
              Priority{arrow('priority')}
            </th>
            <th className="text-left px-4 py-2 text-xs font-medium w-32">Assignee</th>
            <th className="text-left px-4 py-2 text-xs font-medium w-24">Progress</th>
            <th className="text-right px-4 py-2 text-xs font-medium cursor-pointer hover:text-primary w-24" onClick={() => handleSort('updatedAt')}>
              Updated{arrow('updatedAt')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const statusCfg = KANBAN_COLUMNS.find((c) => c.key === task.status);
            const priorityCfg = PRIORITY_CONFIG[task.priority];

            return (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="border-b border-border last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium line-clamp-1">{task.title}</span>
                  {task.labels.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {task.labels.slice(0, 3).map((l) => (
                        <span key={l} className="text-[10px] px-1 py-0.5 rounded bg-secondary/20">{l}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: statusCfg?.color }} />
                    {statusCfg?.label}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: `${priorityCfg.color}20`, color: priorityCfg.color }}
                  >
                    {priorityCfg.label}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {task.assignee ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: task.assignee.color ?? '#3b82f6' }}
                      />
                      {task.assignee.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Task progress" className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{task.progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                  {relativeTime(task.updatedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
