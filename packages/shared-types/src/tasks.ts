// Task Board Types — shared between dashboard and backend

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type AssigneeType = 'human' | 'agent';

export interface TaskAssignee {
  id: string;
  type: AssigneeType;
  name: string;
  /** Agent color from VirtualOfficeAgent.color */
  color?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorType: AssigneeType;
  authorName: string;
  content: string;
  createdAt: string;
}

export type TaskAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'progress_updated'
  | 'completed'
  | 'failed';

export interface TaskActivityEntry {
  id: string;
  taskId: string;
  actorId: string;
  actorType: AssigneeType;
  actorName: string;
  action: TaskAction;
  /** e.g. "backlog → in_progress" */
  detail?: string;
  timestamp: string;
}

export interface BoardTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[];
  assignee?: TaskAssignee;
  creatorId: string;
  creatorType: AssigneeType;
  /** 0-100 */
  progress: number;
  comments: TaskComment[];
  activity: TaskActivityEntry[];
  /** Link to AgentTask.id if originated from agent system */
  agentTaskRef?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
