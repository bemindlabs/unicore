'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { uuid } from '@/lib/uuid';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:18789';
const MAX_BACKOFF = 30_000;

export interface ChatMessage {
  id: string;
  text: string;
  author: string;
  authorId: string;
  authorType: 'agent' | 'human';
  authorColor?: string;
  channel: string;
  timestamp: string;
}

export function useChatWebSocket(
  channel: string,
  onMessage: (msg: ChatMessage) => void,
): {
  connected: boolean;
  send: (text: string, author: string, authorId: string, authorType: 'agent' | 'human', authorColor?: string) => void;
} {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(2000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;
  const channelRef = useRef(channel);
  channelRef.current = channel;

  const send = useCallback(
    (text: string, author: string, authorId: string, authorType: 'agent' | 'human', authorColor?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const msg: ChatMessage = {
        id: uuid(),
        text,
        author,
        authorId,
        authorType,
        authorColor,
        channel: channelRef.current,
        timestamp: new Date().toISOString(),
      };
      ws.send(
        JSON.stringify({
          type: 'message:publish',
          messageId: uuid(),
          timestamp: new Date().toISOString(),
          payload: {
            fromAgentId: 'dashboard-ui',
            channel: channelRef.current,
            data: msg,
          },
        }),
      );
      // Show own message immediately
      callbackRef.current(msg);
    },
    [],
  );

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 2000;
        ws.send(
          JSON.stringify({
            type: 'message:subscribe',
            messageId: uuid(),
            timestamp: new Date().toISOString(),
            payload: { agentId: 'dashboard-ui', channel: channelRef.current },
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (
            msg.type === 'message:publish' &&
            msg.payload?.channel === channelRef.current &&
            msg.payload?.data?.text
          ) {
            const chatMsg = msg.payload.data as ChatMessage;
            // Skip own messages (already shown via send())
            if (msg.payload.fromAgentId !== 'dashboard-ui') {
              callbackRef.current(chatMsg);
            }
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
  }, []);

  // Reconnect when channel changes
  useEffect(() => {
    unmountedRef.current = false;

    // Close existing connection and reconnect with new channel
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
  }, [connect, channel]);

  return { connected, send };
}
