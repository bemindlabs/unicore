'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageCircle, X, Minimize2, ChevronDown, ArrowLeft } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { getAgents } from '@/lib/backoffice/store';
import type { BackofficeAgent } from '@/lib/backoffice/types';

const GENERAL_CHANNEL = 'chat-backoffice';

function agentChannel(agentId: string): string {
  return `chat-agent-${agentId}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent selection state
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<BackofficeAgent | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const channel = selectedAgent ? agentChannel(selectedAgent.id) : GENERAL_CHANNEL;

  // Fetch agents when chat opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAgents().then(({ agents: list }) => {
      if (!cancelled) setAgents(list);
    });
    return () => { cancelled = true; };
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-99), msg]); // Keep last 100
    if (!open) setUnread((n) => n + 1);
  }, [open]);

  const { connected, send } = useChatWebSocket(channel, handleMessage);

  // Clear messages when switching channels
  const prevChannelRef = useRef(channel);
  useEffect(() => {
    if (prevChannelRef.current !== channel) {
      setMessages([]);
      prevChannelRef.current = channel;
    }
  }, [channel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  function handleSend() {
    if (!input.trim()) return;
    send(input.trim(), 'You', 'human-user', 'human');
    setInput('');
  }

  function selectAgent(agent: BackofficeAgent) {
    setSelectedAgent(agent);
    setDropdownOpen(false);
  }

  function backToGeneral() {
    setSelectedAgent(null);
    setDropdownOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-sm font-medium">Chat</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-80 h-[28rem] rounded-lg border bg-card shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedAgent ? (
            <>
              <button
                onClick={backToGeneral}
                className="p-0.5 hover:bg-primary-foreground/10 rounded flex-shrink-0"
                aria-label="Back to General"
                title="Back to General"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: selectedAgent.color }}
              />
              <span className="text-sm font-medium truncate">{selectedAgent.name}</span>
            </>
          ) : (
            <>
              <MessageCircle className="h-4 w-4 flex-shrink-0" />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium hover:bg-primary-foreground/10 rounded px-1 py-0.5"
                >
                  Team Chat
                  <ChevronDown className="h-3 w-3" />
                </button>
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 rounded-md border bg-popover text-popover-foreground shadow-md z-10">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b">
                      Direct message
                    </div>
                    {agents.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No agents found</div>
                    )}
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => selectAgent(agent)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: agent.color }}
                        />
                        <span className="truncate">{agent.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-muted'}`} />
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-primary-foreground/10 rounded" aria-label="Minimize">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-primary-foreground/10 rounded" aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">
            {selectedAgent
              ? `Start a conversation with ${selectedAgent.name}`
              : 'No messages yet. Start the conversation!'}
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.authorId === 'human-user';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {!isMe && msg.authorColor && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: msg.authorColor }} />
                  )}
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {isMe ? 'You' : msg.author}
                  </span>
                  {msg.authorType === 'agent' && (
                    <span className="text-[9px] px-1 rounded bg-primary/10 text-primary">agent</span>
                  )}
                  <span className="text-[9px] text-muted-foreground">{relativeTime(msg.timestamp)}</span>
                </div>
                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t p-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={
              connected
                ? selectedAgent
                  ? `Message ${selectedAgent.name}...`
                  : 'Type a message...'
                : 'Connecting...'
            }
            disabled={!connected}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !connected}
            className="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
