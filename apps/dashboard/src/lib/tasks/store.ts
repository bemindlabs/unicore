import type { BoardTask, TaskComment, TaskActivityEntry } from './types';
import { defaultTasks } from './defaults';
import { api } from '@/lib/api';

const STORAGE_KEY = 'unicore_board_tasks';

function getCached(): BoardTask[] {
  if (typeof window === 'undefined') return defaultTasks;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as BoardTask[]) : defaultTasks;
  } catch {
    return defaultTasks;
  }
}

function setCache(tasks: BoardTask[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function makeActivity(
  taskId: string,
  actorId: string,
  actorType: 'human' | 'agent',
  actorName: string,
  action: TaskActivityEntry['action'],
  detail?: string,
): TaskActivityEntry {
  return {
    id: crypto.randomUUID(),
    taskId,
    actorId,
    actorType,
    actorName,
    action,
    detail,
    timestamp: new Date().toISOString(),
  };
}

export async function getTasks(): Promise<{ tasks: BoardTask[]; cached: boolean }> {
  try {
    const data = await api.get<{ tasks: BoardTask[] }>('/api/proxy/tasks');
    const tasks = data.tasks.length > 0 ? data.tasks : defaultTasks;
    setCache(tasks);
    return { tasks, cached: false };
  } catch {
    return { tasks: getCached(), cached: true };
  }
}

export async function createTask(
  task: Omit<BoardTask, 'id' | 'createdAt' | 'updatedAt' | 'activity' | 'comments'>,
): Promise<BoardTask[]> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const newTask: BoardTask = {
    ...task,
    id,
    comments: [],
    activity: [
      makeActivity(id, task.creatorId, task.creatorType, task.assignee?.name ?? 'You', 'created'),
    ],
    createdAt: now,
    updatedAt: now,
  };

  try {
    await api.post('/api/proxy/tasks', newTask);
  } catch {
    // Local-only mode
  }

  const tasks = [...getCached(), newTask];
  setCache(tasks);
  return tasks;
}

export async function updateTask(
  id: string,
  patch: Partial<BoardTask>,
  actor: { id: string; type: 'human' | 'agent'; name: string } = { id: 'user-1', type: 'human', name: 'You' },
): Promise<BoardTask[]> {
  const now = new Date().toISOString();
  const tasks = getCached().map((t) => {
    if (t.id !== id) return t;

    const newActivity: TaskActivityEntry[] = [...t.activity];
    // Clone patch to avoid mutating the caller's object
    const appliedPatch: Partial<BoardTask> = { ...patch };

    if (appliedPatch.status && appliedPatch.status !== t.status) {
      newActivity.push(makeActivity(id, actor.id, actor.type, actor.name, 'status_changed', `${t.status} → ${appliedPatch.status}`));
      if (appliedPatch.status === 'done') {
        appliedPatch.completedAt = now;
        appliedPatch.progress = 100;
        newActivity.push(makeActivity(id, actor.id, actor.type, actor.name, 'completed'));
      }
    }
    if (appliedPatch.assignee && appliedPatch.assignee.id !== t.assignee?.id) {
      newActivity.push(makeActivity(id, actor.id, actor.type, actor.name, 'assigned', `Assigned to ${appliedPatch.assignee.name}`));
    }
    if (appliedPatch.progress !== undefined && appliedPatch.progress !== t.progress) {
      newActivity.push(makeActivity(id, actor.id, actor.type, actor.name, 'progress_updated', `${t.progress}% → ${appliedPatch.progress}%`));
    }

    return { ...t, ...appliedPatch, activity: newActivity, updatedAt: now };
  });

  try {
    await api.put(`/api/proxy/tasks/${id}`, patch);
  } catch {
    // Local-only mode
  }

  setCache(tasks);
  return tasks;
}

export async function deleteTask(id: string): Promise<BoardTask[]> {
  try {
    await api.delete(`/api/proxy/tasks/${id}`);
  } catch {
    // Local-only mode
  }

  const tasks = getCached().filter((t) => t.id !== id);
  setCache(tasks);
  return tasks;
}

export async function addComment(
  taskId: string,
  authorId: string,
  authorType: 'human' | 'agent',
  authorName: string,
  content: string,
): Promise<BoardTask[]> {
  const now = new Date().toISOString();
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    taskId,
    authorId,
    authorType,
    authorName,
    content,
    createdAt: now,
  };

  const tasks = getCached().map((t) => {
    if (t.id !== taskId) return t;
    return {
      ...t,
      comments: [...t.comments, comment],
      activity: [...t.activity, makeActivity(taskId, authorId, authorType, authorName, 'commented')],
      updatedAt: now,
    };
  });

  try {
    await api.post(`/api/proxy/tasks/${taskId}/comments`, comment);
  } catch {
    // Local-only mode
  }

  setCache(tasks);
  return tasks;
}
