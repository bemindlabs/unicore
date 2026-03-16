'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { StatusIndicator } from './StatusIndicator';

interface Props {
  agent: BackofficeAgent;
  open: boolean;
  onClose: () => void;
}

export function AgentTerminal({ agent, open, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { connected, send } = useChatWebSocket(
    `terminal-${agent.id}`,
    handleMessage,
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Reset messages when agent changes
  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [agent.id]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    send(trimmed, 'Human', 'human-operator', 'human');
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ background: '#0a0e14' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-green-900/40 bg-[#0c1118]">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor:
                agent.status === 'working'
                  ? '#22c55e'
                  : agent.status === 'idle'
                    ? '#eab308'
                    : '#64748b',
            }}
          />
          <div className="min-w-0">
            <div className="font-mono text-xs text-green-400 truncate uppercase tracking-wider">
              {agent.name}
            </div>
            <div className="font-mono text-[9px] text-green-600/60 uppercase tracking-wider">
              {agent.role} &middot; <StatusIndicator status={agent.status} showLabel />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[9px] px-2 py-0.5 rounded ${
              connected
                ? 'text-green-400 bg-green-500/10'
                : 'text-red-400 bg-red-500/10'
            }`}
          >
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
          <button
            onClick={onClose}
            className="text-green-600/60 hover:text-green-400 transition-colors font-mono text-lg leading-none px-1"
            aria-label="Close terminal"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Scrollable log area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{ background: '#0a0e14' }}
      >
        {messages.length === 0 && (
          <div className="font-mono text-[10px] text-green-700/50 py-8 text-center uppercase tracking-wider">
            Terminal session with {agent.name}. Type a command below.
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="font-mono text-xs leading-relaxed">
            <span
              className={
                msg.authorType === 'human'
                  ? 'text-cyan-400'
                  : 'text-green-500'
              }
            >
              {msg.authorType === 'human' ? '$ ' : '> '}
            </span>
            <span
              className={
                msg.authorType === 'human'
                  ? 'text-cyan-300/80'
                  : 'text-green-400/90'
              }
            >
              {msg.text}
            </span>
            <span className="text-green-900/40 ml-2 text-[9px]">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-green-900/40 px-4 py-3 bg-[#0c1118]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-green-500 flex-shrink-0">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent font-mono text-xs text-green-300 placeholder-green-800/50 outline-none"
            disabled={!connected}
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="font-mono text-[9px] text-green-500 hover:text-green-300 disabled:text-green-900/30 transition-colors uppercase tracking-wider px-2 py-1"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
