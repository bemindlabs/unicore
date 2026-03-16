'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { getAgents } from '@/lib/backoffice/store';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { StatusIndicator } from './StatusIndicator';

/* ------------------------------------------------------------------ */
/*  Quick prompts per agent type                                       */
/* ------------------------------------------------------------------ */

const QUICK_PROMPTS: Record<string, string[]> = {
  router: [
    "What's the status of our orders?",
    'Summarize today\'s activity',
  ],
  finance: [
    'Generate monthly revenue report',
    'List overdue invoices',
  ],
  growth: [
    'Draft a marketing email',
    'Analyze customer churn',
  ],
  ops: [
    'Check system health',
    'Review deployment status',
  ],
  research: [
    'Research competitor pricing',
    'Summarize latest trends',
  ],
};

const DEFAULT_PROMPTS = [
  'What can you help me with?',
  'Show me a summary of your recent activity',
];

function commandChannel(agentId: string): string {
  return `command-${agentId}`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m} ${ampm}`;
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandCenter() {
  /* --- agents --- */
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<BackofficeAgent | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAgents().then(({ agents: list }) => {
      if (cancelled) return;
      setAgents(list);
      // Select the router agent by default
      const router = list.find((a) => a.id === 'router');
      setSelectedAgent(router ?? list[0] ?? null);
    });
    return () => { cancelled = true; };
  }, []);

  /* --- messages --- */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const channel = selectedAgent ? commandChannel(selectedAgent.id) : 'command-router';

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-199), msg]);
  }, []);

  const { connected, send } = useChatWebSocket(channel, handleMessage);

  // Clear messages when switching agents
  const prevChannelRef = useRef(channel);
  useEffect(() => {
    if (prevChannelRef.current !== channel) {
      setMessages([]);
      prevChannelRef.current = channel;
    }
  }, [channel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /* --- input --- */
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || !selectedAgent) return;
    send(value, 'You', 'human-user', 'human');
    setInput('');
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleAgentClick(agent: BackofficeAgent) {
    setSelectedAgent(agent);
  }

  const prompts = selectedAgent
    ? QUICK_PROMPTS[selectedAgent.id] ?? DEFAULT_PROMPTS
    : DEFAULT_PROMPTS;

  return (
    <div className="flex h-full min-h-0 border border-cyan-900/30 bg-[#0a0e1a]/60 backdrop-blur-sm rounded-lg overflow-hidden">
      {/* ---- Left: Agent Selector ---- */}
      <aside className="w-64 flex-shrink-0 border-r border-cyan-900/30 overflow-y-auto bg-[#080c16]/80">
        <div className="px-4 py-3 border-b border-cyan-900/30">
          <h2 className="font-mono text-[10px] text-cyan-600/60 uppercase tracking-wider">
            Select Agent
          </h2>
        </div>
        <div className="p-2 space-y-1">
          {agents.map((agent) => {
            const active = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent)}
                className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                  active
                    ? 'bg-cyan-500/15 border border-cyan-500/30'
                    : 'hover:bg-cyan-500/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: agent.color }}
                  />
                  <span
                    className={`font-mono text-xs font-bold tracking-wider ${
                      active ? 'text-cyan-300' : 'text-cyan-500/80'
                    }`}
                  >
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 ml-[18px]">
                  <span className="text-[10px] text-cyan-600/50 font-mono truncate">
                    {agent.role}
                  </span>
                  <StatusIndicator status={agent.status} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ---- Right: Conversation ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Conversation header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-cyan-900/30">
          {selectedAgent && (
            <>
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: selectedAgent.color }}
              />
              <div>
                <span className="font-mono text-sm text-cyan-300 font-bold tracking-wider">
                  {selectedAgent.name}
                </span>
                <span className="font-mono text-[10px] text-cyan-600/50 ml-2">
                  {selectedAgent.role}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="font-mono text-[9px] text-cyan-600/40 uppercase">
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && selectedAgent && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <span
                className="w-10 h-10 rounded-full mb-4"
                style={{ background: selectedAgent.color, opacity: 0.3 }}
              />
              <p className="font-mono text-xs text-cyan-600/50">
                Start a conversation with {selectedAgent.name}
              </p>
              <p className="font-mono text-[10px] text-cyan-600/30 mt-1">
                Type a prompt below or pick a suggestion
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.authorId === 'human-user';
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {!isMe && msg.authorColor && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: msg.authorColor }}
                      />
                    )}
                    <span className="font-mono text-[10px] text-cyan-600/50">
                      {isMe ? 'You' : msg.author}
                    </span>
                    <span className="font-mono text-[9px] text-cyan-600/30">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2.5 text-sm font-mono leading-relaxed whitespace-pre-wrap ${
                      isMe
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/20'
                        : 'bg-[#0d1220] text-cyan-100/80 border border-cyan-900/20'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Prompts */}
        <div className="px-5 pt-2 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              disabled={!connected}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full border border-cyan-500/20 text-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-cyan-900/30">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                connected
                  ? `Ask ${selectedAgent?.name ?? 'an agent'} anything...`
                  : 'Connecting...'
              }
              disabled={!connected}
              rows={3}
              className="flex-1 resize-none rounded-md border border-cyan-900/40 bg-[#080c16] px-4 py-3 text-sm font-mono text-cyan-200 placeholder:text-cyan-600/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-40"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !connected}
              className="flex-shrink-0 rounded-md bg-cyan-500/20 border border-cyan-500/30 p-3 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              aria-label="Send message"
              title="Send (Ctrl+Enter)"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="font-mono text-[9px] text-cyan-600/30 mt-1.5 text-right">
            Press Ctrl+Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
