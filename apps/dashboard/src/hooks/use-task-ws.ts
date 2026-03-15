'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { BoardTask, TaskStatus } from '@/lib/tasks/types';
import type { AgentTask } from '@unicore/shared-types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:18789';
const MAX_BACKOFF = 30_000;

/** Map AgentTask status to BoardTask status */
function mapAgentStatus(status: AgentTask['status']): TaskStatus {
  switch (status) {
    case 'pending': return 'todo';
    case 'running': return 'in_progress';
    case 'completed': return 'done';
    case 'failed': return 'review';
  }
}

function agentTaskToBoardTask(at: AgentTask): BoardTask {
  const now = new Date().toISOString();
  return {
    id: `agent-${at.id}`,
    title: at.type,
    status: mapAgentStatus(at.status),
    priority: 'medium',
    labels: ['agent-task'],
    assignee: { id: at.agentId, type: 'agent', name: at.agentId.toUpperCase() },
    creatorId: at.agentId,
    creatorType: 'agent',
    progress: at.status === 'completed' ? 100 : at.status === 'running' ? 50 : 0,
    comments: [],
    activity: [{
      id: crypto.randomUUID(),
      taskId: `agent-${at.id}`,
      actorId: at.agentId,
      actorType: 'agent',
      actorName: at.agentId.toUpperCase(),
      action: 'created',
      timestamp: at.createdAt,
    }],
    agentTaskRef: at.id,
    createdAt: at.createdAt,
    updatedAt: now,
    completedAt: at.completedAt,
  };
}

export function useTaskWebSocket(onTaskUpdate: (task: BoardTask) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(2000);
  const callbackRef = useRef(onTaskUpdate);
  callbackRef.current = onTaskUpdate;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 2000;
        // Subscribe to tasks channel
        ws.send(JSON.stringify({
          type: 'message:subscribe',
          messageId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: { agentId: 'dashboard-ui', channel: 'tasks' },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'message:publish' && msg.payload?.channel === 'tasks') {
            const agentTask = msg.payload.data as AgentTask;
            if (agentTask?.id) {
              callbackRef.current(agentTaskToBoardTask(agentTask));
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect with exponential backoff
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF);
        setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket constructor failed (e.g., SSR)
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected };
}
