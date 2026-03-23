'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Terminal, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@unicore/ui';

interface TerminalModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (connected: boolean) => void;
}

export function TerminalModal({ open, onClose, onConnected }: TerminalModalProps) {
  const [connected, setConnected] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updateConnected = useCallback(
    (value: boolean) => {
      setConnected(value);
      onConnected?.(value);
    },
    [onConnected],
  );

  const checkConnection = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ssh/`);
      wsRef.current = ws;
      ws.onopen = () => updateConnected(true);
      ws.onerror = () => updateConnected(false);
      ws.onclose = () => updateConnected(false);
    } catch {
      updateConnected(false);
    }
  }, [updateConnected]);

  useEffect(() => {
    if (open) {
      checkConnection();
    } else {
      wsRef.current?.close();
      setConnected(false);
    }
    return () => {
      wsRef.current?.close();
    };
  }, [open, checkConnection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-[#0d1117] border border-border/50 rounded-lg shadow-2xl overflow-hidden transition-all duration-200 ${
          maximized ? 'w-full h-full rounded-none' : 'w-[900px] h-[560px] max-w-[95vw] max-h-[90vh]'
        }`}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between h-10 px-3 bg-[#161b22] border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium text-foreground/80">Terminal</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <span
                className={`inline-block h-2 w-2 rounded-full transition-colors ${
                  connected ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]' : 'bg-muted-foreground/40'
                }`}
              />
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setMaximized((m) => !m)}
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Terminal iframe */}
        <iframe
          ref={iframeRef}
          src="/ssh/"
          className="flex-1 w-full border-0"
          title="SSH Terminal"
          onLoad={() => setConnected(true)}
          onError={() => setConnected(false)}
        />
      </div>
    </div>
  );
}
