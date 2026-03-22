'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Copy, Check, Trash2, BookmarkPlus, Shield, Cpu, Users } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { getAgents } from '@/lib/backoffice/store';
import { api } from '@/lib/api';
import type { BackofficeAgent } from '@/lib/backoffice/types';
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

  // ── Theme helpers ──
  const border = isRetroDesk ? 'border-[var(--retrodesk-border)]' : 'border-[var(--bo-border)]';
  const bg = isRetroDesk ? 'bg-[var(--retrodesk-bg)]' : 'bg-[var(--bo-bg)]';
  const surface = isRetroDesk ? 'bg-[var(--retrodesk-surface)]' : 'bg-[var(--bo-bg)]';
  const textMuted = isRetroDesk ? 'text-[var(--retrodesk-muted)]' : 'text-[var(--bo-text-muted)]';
  const textBody = isRetroDesk ? 'text-[var(--retrodesk-text)]' : 'text-[var(--bo-text-body)]';
  const mono = isRetroDesk ? 'retrodesk-mono' : 'font-mono';

  return (
    <div className={`grid grid-rows-1 md:grid-cols-[14rem_1fr] h-full min-h-0 border backdrop-blur-sm rounded-lg overflow-hidden ${border} ${bg}`}>

      {/* ──── Left sidebar: Agent Roster ──── */}
      <aside className={`hidden md:flex flex-col border-r ${border} ${surface}`}>
        <div className={`shrink-0 px-4 py-3 border-b ${border}`}>
          <h2 className={`text-[10px] uppercase tracking-wider ${mono} ${isRetroDesk ? 'retrodesk-heading text-[var(--retrodesk-pink)]' : textMuted}`}>
            Agent Roster
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const commandAgents = agents.filter((a) => a.id === 'router');
            const specialistAgents = agents.filter((a) =>
              ['comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder'].includes(a.id)
            );
            const securityAgents = agents.filter((a) => a.id === 'sentinel');
            const knownIds = new Set(['router', 'comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder', 'sentinel']);
            const otherAgents = agents.filter((a) => !knownIds.has(a.id));

            const groups: { label: string; icon: React.ReactNode; agents: BackofficeAgent[] }[] = [
              { label: 'COMMAND', icon: <Cpu className="w-3 h-3" />, agents: commandAgents },
              { label: 'SPECIALISTS', icon: <Users className="w-3 h-3" />, agents: specialistAgents },
              { label: 'SECURITY', icon: <Shield className="w-3 h-3" />, agents: securityAgents },
            ];
            if (otherAgents.length > 0) {
              groups.push({ label: 'OTHER', icon: <Users className="w-3 h-3" />, agents: otherAgents });
            }

            return groups.filter((g) => g.agents.length > 0).map((group, gi) => (
              <div key={group.label}>
                <div className={`flex items-center gap-1.5 px-4 pt-3 pb-1.5 ${
                  gi > 0 ? `border-t ${border}` : ''
                }`}>
                  <span className={isRetroDesk ? 'text-[var(--retrodesk-muted)]' : 'text-[var(--bo-text-dimmer)]'}>
                    {group.icon}
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest ${
                    isRetroDesk ? 'retrodesk-mono text-[var(--retrodesk-muted)]' : 'font-mono text-[var(--bo-text-dimmer)]'
                  }`}>
                    {group.label}
                  </span>
                </div>
                <div className="flex flex-col px-2 pb-1 space-y-0.5">
                  {group.agents.map((agent) => {
                    const active = selectedAgent?.id === agent.id;
                    const statusColor =
                      agent.status === 'working' ? 'bg-green-400' :
                      agent.status === 'idle' ? 'bg-yellow-400' :
                      'bg-red-500';

                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleAgentClick(agent)}
                        className={`w-full text-left rounded-md px-3 py-2 transition-all duration-150 ${
                          isRetroDesk
                            ? active
                              ? 'bg-[color-mix(in_srgb,var(--retrodesk-pink)_15%,transparent)] border-2 border-[var(--retrodesk-pink)] shadow-[0_0_8px_rgba(255,105,180,0.2)]'
                              : 'hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_5%,transparent)] border-2 border-transparent'
                            : active
                              ? 'bg-[var(--bo-accent-15)] border border-[var(--bo-border-accent)] shadow-[inset_0_0_0_1px_var(--bo-accent-20)]'
                              : 'hover:bg-[var(--bo-accent-5)] border border-transparent hover:border-[var(--bo-border)] hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: agent.color }} />
                          <span className={`text-xs font-bold tracking-wider truncate flex-1 ${mono} ${
                            isRetroDesk
                              ? active ? 'text-[var(--retrodesk-text)]' : 'text-[var(--retrodesk-muted)]'
                              : active ? 'text-[var(--bo-text-accent-2)]' : 'text-[var(--bo-text-info)]'
                          }`}>
                            {agent.name}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor} ${
                            agent.status === 'working' ? 'animate-pulse' : ''
                          }`} />
                        </div>
                        <p className={`text-[10px] ${mono} truncate mt-0.5 ml-4 ${textMuted}`}>{agent.role}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      </aside>

      {/* ──── Mobile: horizontal agent selector ──── */}
      <div className={`md:hidden shrink-0 flex gap-1.5 overflow-x-auto px-3 py-2 border-b ${border} ${surface}`}>
        {agents.map((agent) => {
          const active = selectedAgent?.id === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => handleAgentClick(agent)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${mono} transition-colors ${
                active
                  ? `${isRetroDesk ? 'bg-[color-mix(in_srgb,var(--retrodesk-pink)_20%,transparent)] text-[var(--retrodesk-pink)]' : 'bg-[var(--bo-accent-15)] text-[var(--bo-text-accent)]'} font-bold`
                  : `${textMuted} hover:${bg}`
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: agent.color }} />
              {agent.name}
            </button>
          );
        })}
      </div>

      {/* ──── Right: Conversation panel ──── */}
      <div className="flex flex-col min-w-0 min-h-0">

        {/* ── Header ── */}
        <div className={`shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b ${border}`}>
          {selectedAgent && (
            <>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedAgent.color }} />
              <span className={`text-sm font-bold tracking-wider ${mono} ${isRetroDesk ? 'text-[var(--retrodesk-text)]' : 'text-[var(--bo-text-accent-2)]'}`}>{selectedAgent.name}</span>
              <span className={`text-[10px] ${mono} ${textMuted}`}>{selectedAgent.role}</span>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5">
                {messages.length > 0 && (
                  <>
                    <button
                      onClick={handleManualSave}
                      disabled={isSaving}
                      className={`${mono} text-[9px] ${textMuted} hover:text-[var(--bo-text-accent)] transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bo-accent-10)] disabled:opacity-40`}
                      title="Save conversation to history"
                    >
                      {savedFeedback ? <Check className="w-3 h-3 text-green-400" /> : <BookmarkPlus className="w-3 h-3" />}
                      <span className="hidden sm:inline">{savedFeedback ? 'Saved' : isSaving ? 'Saving…' : 'Save'}</span>
                    </button>
                    <button
                      onClick={() => { if (window.confirm('Clear all messages?')) handleClearMessages(); }}
                      className={`${mono} text-[9px] ${textMuted} hover:text-red-400 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10`}
                      title="Clear conversation"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  </>
                )}
                <span className={`w-2 h-2 rounded-full shrink-0 ${connected
                  ? isRetroDesk ? 'bg-[var(--retrodesk-green)]' : 'bg-green-400 animate-pulse'
                  : 'bg-red-500'
                }`} />
                <span className={`${mono} text-[9px] uppercase hidden sm:inline ${textMuted}`}>
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Messages ── */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && selectedAgent && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <span className="w-10 h-10 rounded-full mb-4 opacity-30" style={{ background: selectedAgent.color }} />
              <p className={`${mono} text-xs ${textMuted}`}>Start a conversation with {selectedAgent.name}</p>
              <p className={`${mono} text-[10px] ${textMuted} mt-1 opacity-60`}>Type a prompt below or pick a suggestion</p>
            </div>
          )}
          {messages.map((msg) => {
            const isMe = msg.authorId === 'human-user';
            return (
              <div key={msg.id} className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {!isMe && msg.authorColor && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: msg.authorColor }} />
                    )}
                    <span className={`${mono} text-[10px] ${textMuted}`}>{isMe ? 'You' : msg.author}</span>
                    <span className={`${mono} text-[9px] ${textMuted} opacity-60`}>{formatTimestamp(msg.timestamp, tz)}</span>
                    {!isMe && <CopyButton text={msg.text} />}
                  </div>
                  <div className={`rounded-lg px-4 py-2.5 text-sm ${mono} leading-relaxed break-words ${
                    isMe
                      ? 'bg-[var(--bo-accent-20)] text-[var(--bo-text-body)] border border-[var(--bo-border-accent)] whitespace-pre-wrap'
                      : 'bg-[var(--bo-bg-bubble)] text-[var(--bo-text-body-soft)] border border-[var(--bo-border-subtle)]'
                  }`}>
                    {isMe ? msg.text : formatMessageText(msg.text)}
                  </div>
                </div>
              </div>
            );
          })}
          {isWaiting && (
            <div className="flex justify-start">
              <div className={`rounded-lg px-4 py-2.5 text-sm ${mono} bg-[var(--bo-bg-bubble)] border border-[var(--bo-border-subtle)] ${textMuted}`}>
                Agent is thinking
                <span className="inline-flex w-6 ml-0.5">
                  <span className="animate-[bounce_1.4s_ease-in-out_infinite]">.</span>
                  <span className="animate-[bounce_1.4s_ease-in-out_0.2s_infinite]">.</span>
                  <span className="animate-[bounce_1.4s_ease-in-out_0.4s_infinite]">.</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick Prompts (max 2 rows) ── */}
        <div className={`shrink-0 px-4 pt-2 pb-1 flex flex-wrap gap-1.5 max-h-16 overflow-hidden`}>
          {prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              disabled={!connected}
              className={`${mono} text-[10px] px-3 py-1 rounded-full border ${border} ${textMuted} hover:bg-[var(--bo-accent-10)] hover:text-[var(--bo-text-accent)] transition-colors disabled:opacity-30`}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* ── Input ── */}
        <div className={`shrink-0 px-4 pb-3 pt-2 border-t ${border}`}>
          <div className="flex gap-2 items-stretch">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? `Ask ${selectedAgent?.name ?? 'an agent'} anything...` : 'Connecting...'}
              disabled={!connected}
              rows={2}
              className={`flex-1 min-w-0 resize-none rounded-md border px-3 py-2 text-sm focus:outline-none disabled:opacity-40 ${
                isRetroDesk
                  ? 'border-[var(--retrodesk-border)] bg-[var(--retrodesk-surface)] retrodesk-mono text-[var(--retrodesk-text)] placeholder:text-[var(--retrodesk-muted)] focus:border-[var(--retrodesk-pink)] focus:ring-1 focus:ring-[var(--retrodesk-pink)]'
                  : `border-[var(--bo-border-strong)] ${bg} ${mono} ${textBody} placeholder:${textMuted} focus:border-[var(--bo-border-accent-hover)] focus:ring-1 focus:ring-[var(--bo-accent-20)]`
              }`}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || !connected}
              className={`shrink-0 self-end rounded-md border p-2.5 disabled:opacity-30 transition-all ${
                isRetroDesk
                  ? 'bg-[color-mix(in_srgb,var(--retrodesk-pink)_15%,transparent)] border-[var(--retrodesk-pink)] text-[var(--retrodesk-pink)] hover:bg-[color-mix(in_srgb,var(--retrodesk-pink)_25%,transparent)]'
                  : 'bg-[var(--bo-accent-20)] border-[var(--bo-border-accent)] text-[var(--bo-text-accent)] hover:bg-[var(--bo-accent-30)]'
              }`}
              title="Send (Ctrl+Enter)"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className={`${mono} text-[9px] mt-1 text-right ${textMuted} opacity-50`}>Ctrl+Enter to send</p>
        </div>
      </div>
    </div>
  );
}
