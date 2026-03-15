'use client';

import { useState, useRef, useEffect } from 'react';
import type { TaskAssignee } from '@/lib/tasks/types';

interface Props {
  value?: TaskAssignee;
  agents: { id: string; name: string; color: string; status: string }[];
  onChange: (assignee: TaskAssignee | undefined) => void;
}

export function AssigneePicker({ value, agents, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const humanUser: TaskAssignee = { id: 'user-1', type: 'human', name: 'You' };

  const options: TaskAssignee[] = [
    humanUser,
    ...agents.map((a) => ({
      id: a.id,
      type: 'agent' as const,
      name: a.name,
      color: a.color,
    })),
  ];

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-input bg-background rounded-md hover:bg-accent/50 transition-colors text-left"
      >
        {value ? (
          <>
            {value.type === 'agent' && value.color && (
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: value.color }} />
            )}
            {value.type === 'human' && (
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500" />
            )}
            <span>{value.name}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{value.type}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Unassigned</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
          <button
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-muted-foreground"
          >
            Unassigned
          </button>
          {options.map((opt) => (
            <button
              key={`${opt.type}-${opt.id}`}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors ${
                value?.id === opt.id && value?.type === opt.type ? 'bg-accent/30' : ''
              }`}
            >
              {opt.type === 'agent' && opt.color ? (
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: opt.color }} />
              ) : (
                <span className="w-3 h-3 rounded-full flex-shrink-0 bg-blue-500" />
              )}
              <span>{opt.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{opt.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
