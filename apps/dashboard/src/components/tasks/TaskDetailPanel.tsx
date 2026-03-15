'use client';

import { useState, useRef, useEffect } from 'react';
import type { BoardTask, TaskStatus, TaskPriority, TaskComment } from '@/lib/tasks/types';
import { KANBAN_COLUMNS, PRIORITY_CONFIG } from '@/lib/tasks/types';
import { ActivityFeed } from './ActivityFeed';
import { AssigneePicker } from './AssigneePicker';

interface Props {
  task: BoardTask;
  agents: { id: string; name: string; color: string; status: string }[];
  onUpdate: (id: string, patch: Partial<BoardTask>) => void;
  onAddComment: (taskId: string, content: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function TaskDetailPanel({ task, agents, onUpdate, onAddComment, onDelete, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  const [commentInput, setCommentInput] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDescription, setLocalDescription] = useState(task.description ?? '');

  // Reset local state when the task changes (e.g. opening a different task)
  const [prevTaskId, setPrevTaskId] = useState(task.id);
  if (task.id !== prevTaskId) {
    setPrevTaskId(task.id);
    setLocalTitle(task.title);
    setLocalDescription(task.description ?? '');
    setConfirmDelete(false);
    setCommentInput('');
    setActiveTab('details');
  }

  function handleCommentSubmit() {
    if (!commentInput.trim()) return;
    onAddComment(task.id, commentInput.trim());
    setCommentInput('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: KANBAN_COLUMNS.find((c) => c.key === task.status)?.color }} />
            <span id="task-detail-dialog-title" className="text-xs text-muted-foreground">{task.id.slice(0, 8)}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Title */}
            <input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => { if (localTitle !== task.title) onUpdate(task.id, { title: localTitle }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-full text-lg font-semibold bg-transparent focus:outline-none border-b border-transparent focus:border-border pb-1"
            />

            {/* Description */}
            <textarea
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={() => { if (localDescription !== (task.description ?? '')) onUpdate(task.id, { description: localDescription }); }}
              placeholder="Add description..."
              rows={3}
              className="w-full text-sm text-muted-foreground bg-transparent focus:outline-none border border-transparent focus:border-border rounded-md px-2 py-1 resize-none"
            />

            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                <select
                  value={task.status}
                  onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
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
                  value={task.priority}
                  onChange={(e) => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
                  className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Assignee</label>
                <AssigneePicker
                  value={task.assignee}
                  agents={agents}
                  onChange={(a) => onUpdate(task.id, { assignee: a })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Progress</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={task.progress}
                    onChange={(e) => onUpdate(task.id, { progress: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{task.progress}%</span>
                </div>
              </div>
            </div>

            {/* Labels */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Labels</label>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((l: string) => (
                  <span key={l} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20">{l}</span>
                ))}
                {task.labels.length === 0 && <span className="text-[10px] text-muted-foreground italic">No labels</span>}
              </div>
            </div>
          </div>

          {/* Tabs: Details / Activity */}
          <div className="border-t border-border">
            <div className="flex border-b border-border">
              {(['details', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'details' ? `Comments (${task.comments.length})` : `Activity (${task.activity.length})`}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'details' ? (
                <div className="space-y-3">
                  {task.comments.map((c: TaskComment) => (
                    <div key={c.id} className="flex gap-2">
                      <span
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ background: c.authorType === 'agent' ? '#8b5cf6' : '#3b82f6' }}
                      >
                        {c.authorName.charAt(0)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{c.authorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {task.comments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <input
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
                      placeholder="Add a comment..."
                      className="flex-1 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={handleCommentSubmit}
                      disabled={!commentInput.trim()}
                      className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <ActivityFeed entries={task.activity} />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-5 py-3 border-t border-border flex-shrink-0">
          <button
            onClick={() => {
              if (confirmDelete) { onDelete(task.id); onClose(); }
              else setConfirmDelete(true);
            }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              confirmDelete
                ? 'bg-destructive text-destructive-foreground'
                : 'text-muted-foreground hover:text-destructive'
            }`}
          >
            {confirmDelete ? 'Confirm Delete?' : 'Delete Task'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
