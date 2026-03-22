'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, MessageCircle, ChevronDown, ArrowLeft, Search, Bell, BellOff } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { getAgents } from '@/lib/backoffice/store';
import { api } from '@/lib/api';
import type { BackofficeAgent } from '@/lib/backoffice/types';

const GENERAL_CHANNEL = 'chat-backoffice';

const REACTION_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F389}', '\u{1F440}'];

const NOTIFICATION_STORAGE_KEY = 'unicore_chat_sound_enabled';

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // Fallback: ignore if AudioContext not available
  }
}

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

interface MessageWithReactions extends ChatMessage {
  reactions?: Record<string, number>;
}

export function ChatBox() {
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [input, setInput] = useState('');
  const open = true; // always open when rendered (parent controls visibility)
  const [_unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent selection state
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<BackofficeAgent | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // UNC-103: Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // UNC-103: Sound notification toggle
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  // UNC-103: Reaction hover state
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Typing indicator — shown while waiting for agent response
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UNC-103: @mention autocomplete
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const channel = selectedAgent ? agentChannel(selectedAgent.id) : GENERAL_CHANNEL;

  // Persist sound preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, String(soundEnabled));
    }
  }, [soundEnabled]);

  // Fetch agents when chat opens — auto-select ROUTER
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAgents().then(({ agents: list }) => {
      if (!cancelled) {
        setAgents(list);
        // Auto-select ROUTER if no agent selected
        if (!selectedAgent) {
          const router = list.find((a) => a.id === 'router');
          if (router) setSelectedAgent(router);
        }
      }
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

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const updated = [...prev.slice(-99), { ...msg, reactions: {} }];
      // Auto-save after agent response
      if (msg.authorType === 'agent' && updated.length >= 2) {
        const agentId = msg.authorId ?? 'router';
        const agentName = msg.author ?? 'Agent';
        api.post('/api/v1/chat-history', {
          agentId,
          agentName,
          messages: updated.map(({ reactions: _r, ...m }) => m),
          summary: updated.find((m) => m.authorType === 'human')?.text?.slice(0, 100) ?? '',
          channel: msg.channel,
        }).catch(() => { /* ignore save errors */ });
      }
      return updated;
    });
    if (!open) setUnread((n) => n + 1);
    // Clear typing indicator when agent responds
    if (msg.authorType === 'agent') {
      setIsAgentTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
    // Play beep on incoming messages from others
    if (msg.authorId !== 'human-user' && soundEnabledRef.current) {
      playBeep();
    }
  }, [open]);

  const { connected, send } = useChatWebSocket(channel, handleMessage);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // Load history when switching channels
  const prevChannelRef = useRef(channel);
  useEffect(() => {
    if (prevChannelRef.current !== channel) {
      prevChannelRef.current = channel;
    }
    // Load saved chat history for this channel
    setMessages([]);
    api.get<{ items: Array<{ id: string }> }>(
      `/api/v1/chat-history?channel=${encodeURIComponent(channel)}&limit=1`,
    )
      .then(async (res) => {
        const latest = res?.items?.[0];
        if (!latest?.id) return;
        // Fetch full record with messages
        const record = await api.get<{ messages?: ChatMessage[] }>(
          `/api/v1/chat-history/${latest.id}`,
        );
        if (record?.messages?.length) {
          setMessages(record.messages.map((m) => ({ ...m, reactions: {} })));
        }
      })
      .catch(() => { /* no history */ });
  }, [channel]);

  useEffect(() => {
    // Use rAF to scroll after DOM renders
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  // UNC-103: Filtered messages for search
  const visibleMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => m.text.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  // UNC-103: Filtered agents for @mention
  const mentionCandidates = useMemo(() => {
    if (!mentionFilter) return agents;
    const f = mentionFilter.toLowerCase();
    return agents.filter((a) => a.name.toLowerCase().includes(f));
  }, [agents, mentionFilter]);

  function addReaction(messageId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...(m.reactions ?? {}) };
        reactions[emoji] = (reactions[emoji] ?? 0) + 1;
        return { ...m, reactions };
      }),
    );
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setInput(value);

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionFilter(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionFilter('');
    }
  }

  function insertMention(agent: BackofficeAgent) {
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, atMatch.index);
      const afterCursor = input.slice(cursorPos);
      setInput(`${beforeAt}@${agent.name} ${afterCursor}`);
    }
    setMentionOpen(false);
    setMentionFilter('');
    inputRef.current?.focus();
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (mentionOpen && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter') {
      handleSend();
    }
  }

  function handleSend() {
    if (!input.trim()) return;
    send(input.trim(), 'You', 'human-user', 'human');
    setInput('');
    setMentionOpen(false);
    // Show typing indicator after sending
    setIsAgentTyping(true);
    // Auto-hide after 30s in case agent doesn't respond
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsAgentTyping(false), 30_000);
  }

  function selectAgent(agent: BackofficeAgent) {
    setSelectedAgent(agent);
    setDropdownOpen(false);
    setIsAgentTyping(false);
  }

  function backToGeneral() {
    setSelectedAgent(null);
    setDropdownOpen(false);
    setIsAgentTyping(false);
  }

  // Render message text with @mentions styled bold
  function renderMessageText(text: string) {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="font-bold text-[var(--bo-text-accent-2)]">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="flex flex-col w-full h-full border-l border-[var(--bo-border)] bg-[var(--bo-bg)] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--bo-border)] bg-[var(--bo-bg-elevated)] text-[var(--bo-text-accent-2)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedAgent ? (
            <>
              <button
                onClick={backToGeneral}
                className="p-1.5 hover:bg-[var(--bo-accent-10)] rounded flex-shrink-0"
                aria-label="Go back"
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
                  className="flex items-center gap-1 text-sm font-medium font-mono hover:bg-[var(--bo-accent-10)] rounded px-1 py-0.5"
                >
                  Team Chat
                  <ChevronDown className="h-3 w-3" />
                </button>
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 rounded-md border border-[var(--bo-border)] bg-[var(--bo-bg-elevated)] text-[var(--bo-text-accent-2)] shadow-md z-10">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--bo-text-muted)] border-b border-[var(--bo-border)] font-mono">
                      Direct message
                    </div>
                    {agents.length === 0 && (
                      <div className="px-3 py-2 text-xs text-[var(--bo-text-dim)] font-mono">No agents found</div>
                    )}
                    {agents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => selectAgent(agent)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-[var(--bo-accent-10)] text-[var(--bo-text-accent-2)] text-left"
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
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-cyan-900/40'}`} />
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {/* UNC-103: Search toggle */}
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setSearchQuery('');
            }}
            className={`p-1.5 hover:bg-[var(--bo-accent-10)] rounded ${searchOpen ? 'bg-[var(--bo-accent-20)]' : ''}`}
            aria-label="Search messages"
            title="Search messages"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          {/* UNC-103: Sound notification toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className={`p-1.5 hover:bg-[var(--bo-accent-10)] rounded ${soundEnabled ? '' : 'opacity-50'}`}
            aria-label={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
            title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
          >
            {soundEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* UNC-103: Search bar */}
      {searchOpen && (
        <div className="px-3 py-2 border-b border-[var(--bo-border)] bg-[var(--bo-bg)]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="w-full rounded-md border border-[var(--bo-border)] bg-[var(--bo-bg-input)] text-[var(--bo-text-accent-2)] placeholder:text-[var(--bo-text-dimmer)] px-3 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--bo-border-accent)] focus:border-[var(--bo-border-accent-hover)]"
          />
          {searchQuery && (
            <div className="text-[10px] text-[var(--bo-text-dim)] mt-1 font-mono">
              {visibleMessages.length} of {messages.length} messages
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {visibleMessages.length === 0 && (
          <p className="text-center text-xs text-[var(--bo-text-dim)] font-mono py-8">
            {searchQuery
              ? 'No messages match your search.'
              : selectedAgent
                ? `Start a conversation with ${selectedAgent.name}`
                : 'No messages yet. Start the conversation!'}
          </p>
        )}
        {visibleMessages.map((msg, _idx) => {
          const isMe = msg.authorId === 'human-user';
          const isHovered = hoveredMessageId === msg.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
            >
              <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {!isMe && msg.authorColor && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: msg.authorColor }} />
                  )}
                  <span className="text-[10px] font-medium text-[var(--bo-text-muted)] font-mono">
                    {isMe ? 'You' : msg.author}
                  </span>
                  {msg.authorType === 'agent' && (
                    <span className="text-[9px] px-1 rounded bg-[var(--bo-accent-10)] text-[var(--bo-text-accent)] font-mono">agent</span>
                  )}
                  <span className="text-[9px] text-[var(--bo-text-dimmer)] font-mono">{relativeTime(msg.timestamp)}</span>
                </div>
                <div className="relative">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-mono ${
                      isMe
                        ? 'bg-[var(--bo-accent-20)] text-[var(--bo-text-body)] border border-[var(--bo-border-accent)]'
                        : 'bg-[var(--bo-bg-bubble)] text-[var(--bo-text-body-soft)] border border-[var(--bo-border-subtle)]'
                    }`}
                  >
                    {renderMessageText(msg.text)}
                  </div>

                  {/* UNC-103: Reaction picker on hover */}
                  {isHovered && (
                    <div
                      className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex gap-0.5 bg-[var(--bo-bg-elevated)] border border-[var(--bo-border)] rounded-full shadow-md px-1 py-0.5 z-10`}
                    >
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(msg.id, emoji)}
                          className="w-5 h-5 flex items-center justify-center text-xs hover:bg-[var(--bo-accent-10)] rounded-full transition-colors"
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* UNC-103: Reaction badges */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {Object.entries(msg.reactions)
                      .filter(([, count]) => count > 0)
                      .map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => addReaction(msg.id, emoji)}
                          className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--bo-border)] bg-[var(--bo-accent-5)] hover:bg-[var(--bo-accent-10)] transition-colors"
                        >
                          <span>{emoji}</span>
                          <span className="text-[var(--bo-text-muted)]">{count}</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isAgentTyping && (
          <div className="flex justify-start">
            <div className="max-w-[75%]">
              <div className="flex items-center gap-1.5 mb-0.5">
                {selectedAgent?.color && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedAgent.color }} />
                )}
                <span className="text-[10px] font-medium text-[var(--bo-text-muted)] font-mono">
                  {selectedAgent?.name ?? 'Agent'}
                </span>
                <span className="text-[9px] px-1 rounded bg-[var(--bo-accent-10)] text-[var(--bo-text-accent)] font-mono">typing</span>
              </div>
              <div className="rounded-lg px-3 py-2.5 bg-[var(--bo-bg-bubble)] border border-[var(--bo-border-subtle)] inline-flex items-center gap-1">
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--bo-text-muted)] animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--bo-text-muted)] animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[var(--bo-text-muted)] animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--bo-border)] p-2">
        <div className="relative">
          {/* UNC-103: @mention autocomplete dropdown */}
          {mentionOpen && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-md border border-[var(--bo-border)] bg-[var(--bo-bg-elevated)] text-[var(--bo-text-accent-2)] shadow-md z-10 max-h-32 overflow-y-auto">
              {mentionCandidates.map((agent, idx) => (
                <button
                  key={agent.id}
                  onClick={() => insertMention(agent)}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left ${
                    idx === mentionIndex
                      ? 'bg-[var(--bo-accent-15)] text-[var(--bo-text-body)]'
                      : 'hover:bg-[var(--bo-accent-10)] text-[var(--bo-text-accent-2)]'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: agent.color }}
                  />
                  <span className="truncate font-medium font-mono">@{agent.name}</span>
                  <span className="text-[10px] text-[var(--bo-text-muted)] ml-auto font-mono">{agent.role}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              placeholder={
                connected
                  ? selectedAgent
                    ? `Message ${selectedAgent.name}...`
                    : 'Type a message... (@ to mention)'
                  : 'Connecting...'
              }
              disabled={!connected}
              className="flex-1 rounded-md border border-[var(--bo-border)] bg-[var(--bo-bg-input)] text-[var(--bo-text-body)] placeholder:text-[var(--bo-text-dimmer)] px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--bo-border-accent)] focus:border-[var(--bo-border-accent-hover)] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              className="rounded-md bg-[var(--bo-accent-20)] border border-[var(--bo-border-accent)] p-1.5 text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-30)] disabled:opacity-40 transition-colors"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
