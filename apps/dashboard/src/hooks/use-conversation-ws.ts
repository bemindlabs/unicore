'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { uuid } from '@/lib/uuid';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://localhost:18789';
const MAX_BACKOFF = 30_000;

export type ConversationEventType =
  | 'conversation:new'
  | 'conversation:message'
  | 'conversation:assigned'
  | 'conversation:typing';

export interface ConversationEvent {
  type: ConversationEventType;
  messageId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ConversationEntry {
  id: string;
  agentId: string;
  userId: string;
  userChannel: string;
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED';
  assignedTo?: string;
  assignedToName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  isTyping?: boolean;
}

/**
 * Subscribe to conversation events for a specific agent.
 * Connects to the `conversation-<agentId>` channel on OpenClaw WebSocket.
 */
export function useConversationWebSocket(
  agentId: string,
  onEvent: (event: ConversationEvent) => void,
): {
  connected: boolean;
  sendConversationNew: (conversationId: string, userId: string, userChannel: string, metadata?: Record<string, unknown>) => void;
  sendConversationAssigned: (conversationId: string, assignedTo: string, assignedToName: string) => void;
  sendTyping: (conversationId: string, fromId: string, fromType: 'agent' | 'human', isTyping: boolean) => void;
} {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(2000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  const channel = `conversation-${agentId}`;

  const sendRaw = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(msg));
  }, []);

  const sendConversationNew = useCallback(
    (conversationId: string, userId: string, userChannel: string, metadata?: Record<string, unknown>) => {
      sendRaw({
        type: 'conversation:new',
        messageId: uuid(),
        timestamp: new Date().toISOString(),
        payload: {
          conversationId,
          agentId: agentIdRef.current,
          userId,
          channel: userChannel,
          metadata,
        },
      });
    },
    [sendRaw],
  );

  const sendConversationAssigned = useCallback(
    (conversationId: string, assignedTo: string, assignedToName: string) => {
      sendRaw({
        type: 'conversation:assigned',
        messageId: uuid(),
        timestamp: new Date().toISOString(),
        payload: {
          conversationId,
          agentId: agentIdRef.current,
          assignedTo,
          assignedToName,
        },
      });
    },
    [sendRaw],
  );

  const sendTyping = useCallback(
    (conversationId: string, fromId: string, fromType: 'agent' | 'human', isTyping: boolean) => {
      sendRaw({
        type: 'conversation:typing',
        messageId: uuid(),
        timestamp: new Date().toISOString(),
        payload: {
          conversationId,
          agentId: agentIdRef.current,
          fromId,
          fromType,
          isTyping,
        },
      });
    },
    [sendRaw],
  );

  const connect = useCallback(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const wsUrl = token
        ? `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : WS_URL;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 2000;
        ws.send(
          JSON.stringify({
            type: 'message:subscribe',
            messageId: uuid(),
            timestamp: new Date().toISOString(),
            payload: { agentId: 'dashboard-ui', channel },
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ConversationEvent;
          if (
            msg.type === 'conversation:new' ||
            msg.type === 'conversation:message' ||
            msg.type === 'conversation:assigned' ||
            msg.type === 'conversation:typing'
          ) {
            callbackRef.current(msg);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!unmountedRef.current) {
          const delay = backoffRef.current;
          backoffRef.current = Math.min(delay * 2, MAX_BACKOFF);
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket constructor failed
    }
  }, [channel]);

  useEffect(() => {
    unmountedRef.current = false;

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    backoffRef.current = 2000;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { connected, sendConversationNew, sendConversationAssigned, sendTyping };
}
