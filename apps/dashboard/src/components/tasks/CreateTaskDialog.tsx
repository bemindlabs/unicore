'use client';

import { useState, useRef, useEffect } from 'react';
import type { BoardTask, TaskStatus, TaskPriority, TaskAssignee } from '@/lib/tasks/types';
import { KANBAN_COLUMNS, PRIORITY_CONFIG } from '@/lib/tasks/types';
import { AssigneePicker } from './AssigneePicker';

interface Props {
  agents: { id: string; name: string; color: string; status: string }[];
  onSave: (task: Omit<BoardTask, 'id' | 'createdAt' | 'updatedAt' | 'activity' | 'comments'>) => void;
  onClose: () => void;
}

export function CreateTaskDialog({ agents, onSave, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignee, setAssignee] = useState<TaskAssignee | undefined>();
  const [labelInput, setLabelInput] = useState('');
  const [labels, setLabels] = useState<string[]>([]);

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  function handleAddLabel(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && labelInput.trim()) {
      e.preventDefault();
      if (!labels.includes(labelInput.trim())) {
        setLabels([...labels, labelInput.trim()]);
      }
      setLabelInput('');
    }
  }

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      labels,
      assignee,
      creatorId: 'user-1',
      creatorType: 'human',
      progress: 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 id="create-task-dialog-title" className="text-sm font-semibold">New Task</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
              >
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Assignee</label>
            <AssigneePicker value={assignee} agents={agents} onChange={setAssignee} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Labels</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {labels.map((l) => (
                <span key={l} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary/20">
                  {l}
                  <button onClick={() => setLabels(labels.filter((x) => x !== l))} className="text-muted-foreground hover:text-foreground">&times;</button>
                </span>
              ))}
            </div>
            <input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={handleAddLabel}
              placeholder="Type label and press Enter"
              className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
