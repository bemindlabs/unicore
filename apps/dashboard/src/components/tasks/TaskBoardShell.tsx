'use client';

import type { ReactNode } from 'react';

interface Props {
  viewMode: 'kanban' | 'list';
  onViewModeChange: (mode: 'kanban' | 'list') => void;
  onCreateTask: () => void;
  wsConnected: boolean;
  filterBar: ReactNode;
  children: ReactNode;
}

export function TaskBoardShell({ viewMode, onViewModeChange, onCreateTask, wsConnected, filterBar, children }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Tasks Board</h1>
          <span
            className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-muted'}`}
            title={wsConnected ? 'Real-time connected' : 'Offline — using local data'}
          />
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex border border-input rounded-md overflow-hidden">
            <button
              onClick={() => onViewModeChange('kanban')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent/50'
              }`}
              title="Kanban view"
              aria-label="Board view"
            >
              ▦ Board
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent/50'
              }`}
              title="List view"
              aria-label="List view"
            >
              ☰ List
            </button>
          </div>

          <button
            onClick={onCreateTask}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 border-b border-border">
        {filterBar}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {children}
      </div>
    </div>
  );
}
