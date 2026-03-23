'use client';

import type { AssigneeType, TaskPriority } from '@/lib/tasks/types';
import { PRIORITY_CONFIG } from '@/lib/tasks/types';

export interface TaskFilters {
  search: string;
  assigneeType: AssigneeType | 'all';
  priority: TaskPriority | 'all';
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  assigneeType: 'all',
  priority: 'all',
};

interface Props {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

export function TaskFilterBar({ filters, onChange }: Props): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Search tasks..."
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        className="px-3 py-1.5 text-sm border border-input bg-background rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="flex border border-input rounded-md overflow-hidden">
        {(['all', 'human', 'agent'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onChange({ ...filters, assigneeType: type })}
            className={`px-3 py-1.5 text-xs capitalize transition-colors ${
              filters.assigneeType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-foreground hover:bg-accent/50'
            }`}
          >
            {type === 'all' ? 'All' : type === 'human' ? 'Humans' : 'Agents'}
          </button>
        ))}
      </div>

      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value as TaskPriority | 'all' })}
        className="px-3 py-1.5 text-xs border border-input bg-background rounded-md focus:outline-none"
      >
        <option value="all">All priorities</option>
        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.label}</option>
        ))}
      </select>

      {(filters.search || filters.assigneeType !== 'all' || filters.priority !== 'all') && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
