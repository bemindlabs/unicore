'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BoardTask, TaskStatus } from '@/lib/tasks/types';
import { getTasks, createTask, updateTask, deleteTask, addComment } from '@/lib/tasks/store';
import { getAgents } from '@/lib/agents/store';
import type { VirtualOfficeAgent } from '@/lib/agents/types';
import { useTaskWebSocket } from '@/hooks/use-task-ws';
import { TaskBoardShell } from '@/components/tasks/TaskBoardShell';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskListView } from '@/components/tasks/TaskListView';
import { TaskFilterBar, DEFAULT_FILTERS, type TaskFilters } from '@/components/tasks/TaskFilterBar';
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function TasksPage() {
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [agents, setAgents] = useState<VirtualOfficeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tasks-view-mode') as 'kanban' | 'list') ?? 'kanban';
    }
    return 'kanban';
  });
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch tasks
  const fetchData = useCallback(async () => {
    const [taskResult, agentResult] = await Promise.all([getTasks(), getAgents()]);
    setTasks(taskResult.tasks);
    setAgents(agentResult.agents);
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Poll every 10s
  useEffect(() => {
    const id = setInterval(fetchData, 10_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // WebSocket for real-time agent task updates
  const { connected } = useTaskWebSocket(useCallback((updatedTask: BoardTask) => {
    setTasks((prev) => {
      const exists = prev.findIndex((t) => t.id === updatedTask.id || t.agentTaskRef === updatedTask.agentTaskRef);
      if (exists >= 0) {
        const copy = [...prev];
        copy[exists] = { ...copy[exists], ...updatedTask };
        return copy;
      }
      return [...prev, updatedTask];
    });
  }, []));

  // Persist view mode
  function handleViewModeChange(mode: 'kanban' | 'list') {
    setViewMode(mode);
    localStorage.setItem('tasks-view-mode', mode);
  }

  // Handlers
  async function handleCreateTask(task: Parameters<typeof createTask>[0]) {
    setTasks(await createTask(task));
    setShowCreateDialog(false);
  }

  async function handleUpdateTask(id: string, patch: Partial<BoardTask>) {
    const updated = await updateTask(id, patch);
    setTasks(updated);
    // Keep detail panel in sync
    if (selectedTask?.id === id) {
      const fresh = updated.find((t) => t.id === id);
      if (fresh) setSelectedTask(fresh);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    await handleUpdateTask(taskId, { status: newStatus });
  }

  async function handleDeleteTask(id: string) {
    setTasks(await deleteTask(id));
    setSelectedTask(null);
  }

  async function handleAddComment(taskId: string, content: string) {
    const updated = await addComment(taskId, 'user-1', 'human', 'You', content);
    setTasks(updated);
    const fresh = updated.find((t) => t.id === taskId);
    if (fresh) setSelectedTask(fresh);
  }

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.assigneeType !== 'all') {
      if (!t.assignee) return filters.assigneeType === 'human'; // unassigned shown under human
      if (t.assignee.type !== filters.assigneeType) return false;
    }
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
    return true;
  });

  const agentList = agents.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    status: a.status,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <TaskBoardShell
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onCreateTask={() => setShowCreateDialog(true)}
        wsConnected={connected}
        filterBar={<TaskFilterBar filters={filters} onChange={setFilters} />}
      >
        {viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <TaskListView
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
          />
        )}
      </TaskBoardShell>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          agents={agentList}
          onUpdate={handleUpdateTask}
          onAddComment={handleAddComment}
          onDelete={handleDeleteTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {showCreateDialog && (
        <CreateTaskDialog
          agents={agentList}
          onSave={handleCreateTask}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </ErrorBoundary>
  );
}
