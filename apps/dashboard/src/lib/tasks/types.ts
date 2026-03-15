export type {
  BoardTask,
  TaskStatus,
  TaskPriority,
  TaskAssignee,
  TaskComment,
  TaskActivityEntry,
  TaskAction,
  AssigneeType,
} from '@unicore/shared-types';

import type { TaskStatus } from '@unicore/shared-types';

export const KANBAN_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: '#94a3b8' },
  { key: 'todo', label: 'To Do', color: '#6366f1' },
  { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { key: 'review', label: 'Review', color: '#8b5cf6' },
  { key: 'done', label: 'Done', color: '#10b981' },
];

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; order: number }> = {
  critical: { label: 'Critical', color: '#ef4444', order: 0 },
  high: { label: 'High', color: '#f97316', order: 1 },
  medium: { label: 'Medium', color: '#eab308', order: 2 },
  low: { label: 'Low', color: '#6b7280', order: 3 },
};
