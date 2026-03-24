'use client';

import { useState, useCallback } from 'react';
import type { BoardTask, TaskStatus } from '@/lib/tasks/types';
import { KANBAN_COLUMNS } from '@/lib/tasks/types';
import { TaskCard } from './TaskCard';

interface Props {
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export function KanbanBoard({ tasks, onTaskClick, onStatusChange }: Props) {
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent, status: TaskStatus) => {
      e.preventDefault();
      setDragOverColumn(null);
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
        onStatusChange(taskId, status);
      }
    },
    [onStatusChange],
  );

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, task: BoardTask) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTaskClick(task);
        return;
      }

      const colIndex = KANBAN_COLUMNS.findIndex((c) => c.key === task.status);
      if (colIndex === -1) return;

      if (e.key === 'ArrowRight' && colIndex < KANBAN_COLUMNS.length - 1) {
        e.preventDefault();
        onStatusChange(task.id, KANBAN_COLUMNS[colIndex + 1]!.key);
      } else if (e.key === 'ArrowLeft' && colIndex > 0) {
        e.preventDefault();
        onStatusChange(task.id, KANBAN_COLUMNS[colIndex - 1]!.key);
      }
    },
    [onTaskClick, onStatusChange],
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-0 flex-1">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.key);
        const isDragOver = dragOverColumn === col.key;

        return (
          <div
            key={col.key}
            className={`flex-shrink-0 w-72 flex flex-col rounded-lg border transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
            }`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-xs font-medium">{col.label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2" role="list" aria-label={`${col.label} tasks`}>
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  tabIndex={0}
                  role="listitem"
                  onKeyDown={(e) => handleCardKeyDown(e, task)}
                  className="outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-lg"
                >
                  <TaskCard
                    task={task}
                    onClick={() => onTaskClick(task)}
                  />
                </div>
              ))}
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-[10px] text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
