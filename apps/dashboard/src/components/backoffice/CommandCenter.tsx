'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Copy, Check, Trash2, BookmarkPlus } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { getAgents } from '@/lib/backoffice/store';
import { api } from '@/lib/api';
import type { BackofficeAgent } from '@/lib/backoffice/types';
import { StatusIndicator } from './StatusIndicator';
import { useRetroDeskTheme } from './retrodesk/RetroDeskThemeProvider';
import { useBusinessTimezone } from '@/hooks/use-business-timezone';

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

function formatTimestamp(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Message formatting (simple regex-based markdown)                   */
/* ------------------------------------------------------------------ */

function formatMessageText(text: string): React.ReactNode[] {
  // Split by code blocks first
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push(...formatInlineText(text.slice(lastIndex, match.index), parts.length));
    }
    // Code block
    parts.push(
      <pre
        key={`cb-${parts.length}`}
        className="my-2 rounded bg-[var(--bo-bg)] border border-[var(--bo-border)] p-3 overflow-x-auto"
      >
        <code className="text-xs text-[var(--bo-text-body)] font-mono">{match[1].trim()}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(...formatInlineText(text.slice(lastIndex), parts.length));
  }

  return parts.length > 0 ? parts : [text];
}

function formatInlineText(text: string, keyOffset: number): React.ReactNode[] {
  // Process inline code and bold
  const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Inline code
      parts.push(
        <code
          key={`ic-${keyOffset}-${parts.length}`}
          className="px-1.5 py-0.5 rounded bg-[var(--bo-accent-10)] text-[var(--bo-text-accent-2)] text-[12px] font-mono"
        >
          {match[1].slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      // Bold
      parts.push(
        <strong key={`b-${keyOffset}-${parts.length}`} className="font-bold text-[var(--bo-text-body)]">
          {match[2].slice(2, -2)}
        </strong>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/* ------------------------------------------------------------------ */
/*  Copy button component                                              */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 rounded hover:bg-[var(--bo-accent-10)] text-[var(--bo-text-dim)] hover:text-[var(--bo-text-accent)]"
      title="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  LocalStorage helpers                                               */
/* ------------------------------------------------------------------ */

function storageKey(agentId: string): string {
  return `command-center-${agentId}`;
}

function loadMessages(agentId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(agentId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(agentId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(storageKey(agentId), JSON.stringify(messages));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function clearStoredMessages(agentId: string) {
  try {
    localStorage.removeItem(storageKey(agentId));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Save conversation to backend                                       */
/* ------------------------------------------------------------------ */

function generateSummary(msgs: ChatMessage[]): string {
  const firstUserMsg = msgs.find((m) => m.authorId === 'human-user');
  if (!firstUserMsg) return '';
  const agentResponses = msgs.filter((m) => m.authorId !== 'human-user').length;
  const question = firstUserMsg.text.slice(0, 120);
  return agentResponses > 0
    ? `${question} (${agentResponses} response${agentResponses > 1 ? 's' : ''})`
    : question;
}

function saveChatHistory(agent: BackofficeAgent, msgs: ChatMessage[], summary?: string) {
  if (msgs.length === 0) return Promise.resolve();
  return api.post('/api/v1/chat-history', {
    agentId: agent.id,
    agentName: agent.name,
    userId: 'user-1',
    userName: 'You',
    messages: msgs,
    summary: summary ?? generateSummary(msgs),
    channel: 'command',
  }).catch(() => {
    // API unavailable — silently ignore
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandCenter() {
  const { isActive: isRetroDesk } = useRetroDeskTheme();
  const tz = useBusinessTimezone();

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
  const [isWaiting, setIsWaiting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* --- save state --- */
  const [isSaving, setIsSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  // Tracks "agentId:lastMsgId" of the last persisted snapshot to prevent duplicates
  const lastSavedKeyRef = useRef<string>('');
  // Stable refs for use in cleanup (unmount auto-save)
  const messagesRef = useRef<ChatMessage[]>([]);
  const selectedAgentRef = useRef<BackofficeAgent | null>(null);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { selectedAgentRef.current = selectedAgent; }, [selectedAgent]);

  const channel = selectedAgent ? commandChannel(selectedAgent.id) : 'command-router';

  const handleMessage = useCallback((msg: ChatMessage) => {
    setIsWaiting(false);
    setMessages((prev) => {
      const next = [...prev.slice(-199), msg];
      // Persist after receiving a message
      if (selectedAgent) saveMessages(selectedAgent.id, next);
      return next;
    });
  }, [selectedAgent]);

  const { connected, send } = useChatWebSocket(channel, handleMessage);

  // Load persisted messages when switching agents; clear on channel change
  const prevChannelRef = useRef(channel);
  useEffect(() => {
    if (prevChannelRef.current !== channel) {
      setIsWaiting(false);
      if (selectedAgent) {
        setMessages(loadMessages(selectedAgent.id));
      } else {
        setMessages([]);
      }
      prevChannelRef.current = channel;
    }
  }, [channel, selectedAgent]);

  // Load messages on initial agent selection
  useEffect(() => {
    if (selectedAgent) {
      setMessages(loadMessages(selectedAgent.id));
    }
  }, [selectedAgent]);

  // Auto-save on component unmount (e.g. user navigates away)
  useEffect(() => {
    return () => {
      const agent = selectedAgentRef.current;
      const msgs = messagesRef.current;
      if (!agent || msgs.length === 0) return;
      const lastMsgId = msgs[msgs.length - 1]?.id ?? '';
      const key = `${agent.id}:${lastMsgId}`;
      if (key && key !== lastSavedKeyRef.current) {
        saveChatHistory(agent, msgs);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save when user switches tab/window (visibilitychange) or leaves page (beforeunload)
  useEffect(() => {
    function saveOnLeave() {
      const agent = selectedAgentRef.current;
      const msgs = messagesRef.current;
      if (!agent || msgs.length === 0) return;
      const lastMsgId = msgs[msgs.length - 1]?.id ?? '';
      const key = `${agent.id}:${lastMsgId}`;
      if (key && key !== lastSavedKeyRef.current) {
        saveChatHistory(agent, msgs);
        lastSavedKeyRef.current = key;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        saveOnLeave();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', saveOnLeave);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', saveOnLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new messages or when waiting
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isWaiting]);

  /* --- input --- */
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend(text?: string) {
    const value = (text ?? input).trim();
    if (!value || !selectedAgent) return;
    send(value, 'You', 'human-user', 'human');
    setIsWaiting(true);
    setInput('');
    textareaRef.current?.focus();
  }

  async function handleManualSave() {
    if (!selectedAgent || messages.length === 0) return;
    const lastMsgId = messages[messages.length - 1]?.id ?? '';
    const key = `${selectedAgent.id}:${lastMsgId}`;
    if (key && key === lastSavedKeyRef.current) {
      // Already saved — just show feedback
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
      return;
    }
    setIsSaving(true);
    await saveChatHistory(selectedAgent, messages);
    lastSavedKeyRef.current = key;
    setIsSaving(false);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  }

  function handleClearMessages() {
    // Save conversation to chat history before clearing
    if (selectedAgent && messages.length > 0) {
      const lastMsgId = messages[messages.length - 1]?.id ?? '';
      const key = `${selectedAgent.id}:${lastMsgId}`;
      if (!key || key !== lastSavedKeyRef.current) {
        saveChatHistory(selectedAgent, messages);
        lastSavedKeyRef.current = key;
      }
    }
    setMessages([]);
    setIsWaiting(false);
    setSavedFeedback(false);
    lastSavedKeyRef.current = '';
    if (selectedAgent) clearStoredMessages(selectedAgent.id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleAgentClick(agent: BackofficeAgent) {
    // Auto-save current conversation when switching agents
    if (selectedAgent && selectedAgent.id !== agent.id && messages.length > 0) {
      const lastMsgId = messages[messages.length - 1]?.id ?? '';
      const key = `${selectedAgent.id}:${lastMsgId}`;
      if (!key || key !== lastSavedKeyRef.current) {
        saveChatHistory(selectedAgent, messages);
      }
    }
    lastSavedKeyRef.current = '';
    setSavedFeedback(false);
    setSelectedAgent(agent);
  }

  const prompts = selectedAgent
    ? QUICK_PROMPTS[selectedAgent.id] ?? DEFAULT_PROMPTS
    : DEFAULT_PROMPTS;

  return (
    <div className={`flex flex-col md:flex-row h-full min-h-0 border backdrop-blur-sm rounded-lg overflow-hidden ${
      isRetroDesk
        ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-bg)]'
        : 'border-[var(--bo-border)] bg-[var(--bo-bg)]'
    }`}>
      {/* ---- Top (mobile) / Left (desktop): Agent Selector ---- */}
      <aside className={`md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r overflow-x-auto md:overflow-x-hidden md:overflow-y-auto ${
        isRetroDesk
          ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-surface)]'
          : 'border-[var(--bo-border)] bg-[var(--bo-bg)]'
      }`}>
        <div className={`px-4 py-3 border-b hidden md:block ${
          isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)]'
        }`}>
          <h2 className={`text-[10px] uppercase tracking-wider ${
            isRetroDesk ? 'retrodesk-heading text-[var(--retrodesk-pink)]' : 'font-mono text-[var(--bo-text-muted)]'
          }`}>
            Select Agent
          </h2>
        </div>
        <div className="flex md:flex-col p-2 gap-1 md:space-y-1 md:gap-0 overflow-x-auto md:overflow-x-hidden">
          {agents.map((agent) => {
            const active = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => handleAgentClick(agent)}
                className={`flex-shrink-0 md:flex-shrink md:w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                  isRetroDesk
                    ? active
                      ? 'bg-[color-mix(in_srgb,var(--retrodesk-pink)_10%,transparent)] border-2 border-[var(--retrodesk-pink)]'
                      : 'hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_5%,transparent)] border-2 border-transparent'
                    : active
                      ? 'bg-[var(--bo-accent-15)] border border-[var(--bo-border-accent)]'
                      : 'hover:bg-[var(--bo-accent-5)] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: agent.color }}
                  />
                  <span
                    className={`text-xs font-bold tracking-wider whitespace-nowrap ${
                      isRetroDesk
                        ? active ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'retrodesk-mono text-[var(--retrodesk-muted)]'
                        : active ? 'font-mono text-[var(--bo-text-accent-2)]' : 'font-mono text-[var(--bo-text-info)]'
                    }`}
                  >
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 ml-[18px]">
                  <span className={`text-[10px] font-mono truncate ${
                    isRetroDesk ? 'text-[var(--retrodesk-muted)]' : 'text-[var(--bo-text-muted)]'
                  }`}>
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
        <div className={`flex items-center gap-3 px-5 py-3 border-b ${
          isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)]'
        }`}>
          {selectedAgent && (
            <>
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: selectedAgent.color }}
              />
              <div>
                <span className={`text-sm font-bold tracking-wider ${
                  isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-text)]' : 'font-mono text-[var(--bo-text-accent-2)]'
                }`}>
                  {selectedAgent.name}
                </span>
                <span className={`text-[10px] ml-2 ${
                  isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-muted)]' : 'font-mono text-[var(--bo-text-muted)]'
                }`}>
                  {selectedAgent.role}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {messages.length > 0 && (
                  <>
                    <button
                      onClick={handleManualSave}
                      disabled={isSaving}
                      className="font-mono text-[9px] text-[var(--bo-text-dim)] hover:text-[var(--bo-text-accent)] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bo-accent-10)] disabled:opacity-40"
                      title="Save conversation to history"
                    >
                      {savedFeedback ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <BookmarkPlus className="w-3 h-3" />
                      )}
                      {savedFeedback ? 'Saved' : isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Clear all messages? This cannot be undone.')) {
                          handleClearMessages();
                        }
                      }}
                      className="font-mono text-[9px] text-[var(--bo-text-dim)] hover:text-red-400 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10"
                      title="Clear conversation (auto-saves first)"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </>
                )}
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected
                      ? isRetroDesk ? 'bg-[var(--retrodesk-green)]' : 'bg-green-400 animate-pulse'
                      : 'bg-red-500'
                  }`}
                />
                <span className={`font-mono text-[9px] uppercase ${
                  isRetroDesk ? 'text-[var(--retrodesk-muted)]' : 'text-[var(--bo-text-dim)]'
                }`}>
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
              <p className="font-mono text-xs text-[var(--bo-text-muted)]">
                Start a conversation with {selectedAgent.name}
              </p>
              <p className="font-mono text-[10px] text-[var(--bo-text-dimmer)] mt-1">
                Type a prompt below or pick a suggestion
              </p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.authorId === 'human-user';
            return (
              <div
                key={msg.id}
                className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {!isMe && msg.authorColor && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: msg.authorColor }}
                      />
                    )}
                    <span className="font-mono text-[10px] text-[var(--bo-text-muted)]">
                      {isMe ? 'You' : msg.author}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--bo-text-dimmer)]">
                      {formatTimestamp(msg.timestamp, tz)}
                    </span>
                    {!isMe && <CopyButton text={msg.text} />}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2.5 text-sm font-mono leading-relaxed ${
                      isMe
                        ? 'bg-[var(--bo-accent-20)] text-[var(--bo-text-body)] border border-[var(--bo-border-accent)] whitespace-pre-wrap'
                        : 'bg-[var(--bo-bg-bubble)] text-[var(--bo-text-body-soft)] border border-[var(--bo-border-subtle)]'
                    }`}
                  >
                    {isMe ? msg.text : formatMessageText(msg.text)}
                  </div>
                </div>
              </div>
            );
          })}
          {isWaiting && (
            <div className="flex justify-start">
              <div className="max-w-[70%] flex flex-col items-start">
                <div className="rounded-lg px-4 py-2.5 text-sm font-mono bg-[var(--bo-bg-bubble)] text-[var(--bo-text-body-soft)] border border-[var(--bo-border-subtle)]">
                  <span className="text-[var(--bo-text-muted)]">
                    Agent is thinking
                    <span className="inline-flex w-6">
                      <span className="animate-[bounce_1.4s_ease-in-out_infinite]">.</span>
                      <span className="animate-[bounce_1.4s_ease-in-out_0.2s_infinite]">.</span>
                      <span className="animate-[bounce_1.4s_ease-in-out_0.4s_infinite]">.</span>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="px-5 pt-2 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              disabled={!connected}
              className="font-mono text-[10px] px-3 py-1.5 rounded-full border border-[var(--bo-border-accent)] text-[var(--bo-text-muted)] hover:bg-[var(--bo-accent-10)] hover:text-[var(--bo-text-accent)] hover:border-[var(--bo-border-accent-hover)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className={`p-4 border-t ${
          isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)]'
        }`}>
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
              className={`flex-1 resize-none rounded-md border px-4 py-3 text-sm focus:outline-none disabled:opacity-40 ${
                isRetroDesk
                  ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-surface)] retrodesk-mono text-[var(--retrodesk-text)] placeholder:text-[var(--retrodesk-muted)] focus:border-[var(--retrodesk-pink)] focus:ring-1 focus:ring-[var(--retrodesk-pink)]'
                  : 'border-[var(--bo-border-strong)] bg-[var(--bo-bg)] font-mono text-[var(--bo-text-body)] placeholder:text-[var(--bo-text-dimmer)] focus:border-[var(--bo-border-accent-hover)] focus:ring-1 focus:ring-[var(--bo-accent-20)]'
              }`}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !connected}
              className={`flex-shrink-0 rounded-md border p-3 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${
                isRetroDesk
                  ? 'bg-[color-mix(in_srgb,var(--retrodesk-pink)_15%,transparent)] border-[var(--retrodesk-pink)] text-[var(--retrodesk-pink)] hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_25%,transparent)]'
                  : 'bg-[var(--bo-accent-20)] border-[var(--bo-border-accent)] text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-30)] hover:border-[var(--bo-border-accent-hover)]'
              }`}
              aria-label="Send message"
              title="Send (Ctrl+Enter)"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className={`font-mono text-[9px] mt-1.5 text-right ${
            isRetroDesk ? 'text-[var(--retrodesk-muted)]' : 'text-[var(--bo-text-dimmer)]'
          }`}>
            Press Ctrl+Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
