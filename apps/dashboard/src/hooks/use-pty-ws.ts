'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { uuid } from '@/lib/uuid';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:18789';

export function usePtyWebSocket(
  onOutput: (data: string) => void,
  onExit: (exitCode: number) => void,
): {
  connected: boolean;
  sessionId: string | null;
  createSession: (cols: number, rows: number, cwd?: string) => void;
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  destroy: () => void;
} {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onOutputRef = useRef(onOutput);
  onOutputRef.current = onOutput;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const wsUrl = token ? `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : WS_URL;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'pty:created' && msg.payload?.sessionId) {
            sessionIdRef.current = msg.payload.sessionId;
            setSessionId(msg.payload.sessionId);
          } else if (msg.type === 'pty:output' && msg.payload?.sessionId === sessionIdRef.current) {
            onOutputRef.current(msg.payload.data);
          } else if (msg.type === 'pty:exit' && msg.payload?.sessionId === sessionIdRef.current) {
            onExitRef.current(msg.payload.exitCode ?? 0);
            sessionIdRef.current = null;
            setSessionId(null);
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        sessionIdRef.current = null;
        setSessionId(null);
      };

      ws.onerror = () => ws.close();
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const createSession = useCallback((cols: number, rows: number, cwd?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'pty:create',
      messageId: uuid(),
      timestamp: new Date().toISOString(),
      payload: { cols, rows, cwd },
    }));
  }, []);

  const sendInput = useCallback((data: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionIdRef.current) return;
    ws.send(JSON.stringify({
      type: 'pty:input',
      messageId: uuid(),
      timestamp: new Date().toISOString(),
      payload: { sessionId: sessionIdRef.current, data },
    }));
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionIdRef.current) return;
    ws.send(JSON.stringify({
      type: 'pty:resize',
      messageId: uuid(),
      timestamp: new Date().toISOString(),
      payload: { sessionId: sessionIdRef.current, cols, rows },
    }));
  }, []);

  const destroy = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionIdRef.current) return;
    ws.send(JSON.stringify({
      type: 'pty:destroy',
      messageId: uuid(),
      timestamp: new Date().toISOString(),
      payload: { sessionId: sessionIdRef.current },
    }));
    sessionIdRef.current = null;
    setSessionId(null);
  }, []);

  return { connected, sessionId, createSession, sendInput, sendResize, destroy };
}
