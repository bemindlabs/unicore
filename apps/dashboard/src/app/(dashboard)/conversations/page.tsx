'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Send,
  Bot,
  User,
  CheckCheck,
  Circle,
  Inbox,
  Zap,
  ZapOff,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Input, Skeleton, cn } from '@unicore/ui';
import { api } from '@/lib/api';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConvMessage {
  id: string;
  text: string;
  author: string;
  authorId: string;
  authorType: string;
  isAiGenerated: boolean;
  channel: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  channel: string;
  contactId: string | null;
  contactName: string | null;
  contactAvatar: string | null;
  agentId: string | null;
  agentName: string | null;
  title: string | null;
  userId: string | null;
  status: string;
  autoRespond: boolean;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: ConvMessage[];
}

/* ------------------------------------------------------------------ */
/*  Channel configuration                                               */
/* ------------------------------------------------------------------ */

const CHANNELS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'command', label: 'Commander' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'LINE', label: 'LINE' },
  { value: 'line', label: 'LINE' },
  { value: 'LIVE_CHAT', label: 'Live Chat' },
  { value: 'web', label: 'Web' },
  { value: 'api', label: 'API' },
];

const CHANNEL_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'LINE', label: 'LINE' },
  { value: 'LIVE_CHAT', label: 'Live Chat' },
  { value: 'web', label: 'Web' },
  { value: 'api', label: 'API' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const CHANNEL_COLORS: Record<string, string> = {
  TELEGRAM: '#2aabee',
  telegram: '#2aabee',
  LINE: '#06c755',
  line: '#06c755',
  LIVE_CHAT: '#6366f1',
  web: '#6366f1',
  api: '#f59e0b',
  command: '#8b5cf6',
};

function channelColor(ch: string) {
  return CHANNEL_COLORS[ch] ?? '#64748b';
}

function channelLabel(ch: string) {
  const found = CHANNELS.find((c) => c.value === ch);
  return found ? found.label : ch;
}

function ChannelIcon({ channel, size = 14 }: { channel: string; size?: number }) {
  const style = { width: size, height: size };
  const ch = channel?.toUpperCase?.() ?? channel;
  if (ch === 'TELEGRAM') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" style={style}>
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-2.022 9.527c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 13.771l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.462c.537-.194 1.006.131.958.789z" />
      </svg>
    );
  }
  if (ch === 'LINE') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" style={style}>
        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
      </svg>
    );
  }
  if (ch === 'LIVE_CHAT' || channel === 'web') {
    return <MessageSquare style={style} />;
  }
  if (channel === 'api') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}>
        <path d="M8 9l3 3-3 3M13 15h3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
      </svg>
    );
  }
  return <Bot style={style} />;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    OPEN: { label: 'Open', className: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800' },
    open: { label: 'Open', className: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800' },
    PENDING: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
    pending: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800' },
    ASSIGNED: { label: 'Assigned', className: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
    assigned: { label: 'Assigned', className: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
    RESOLVED: { label: 'Resolved', className: 'bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700' },
    resolved: { label: 'Resolved', className: 'bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700' },
    CLOSED: { label: 'Closed', className: 'bg-red-500/10 text-red-500 border-red-200 dark:border-red-800' },
    closed: { label: 'Closed', className: 'bg-red-500/10 text-red-500 border-red-200 dark:border-red-800' },
  };
  const config = configs[status] ?? { label: status, className: '' };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', config.className)}>
      {config.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function convDisplayName(conv: Conversation): string {
  return conv.contactName ?? conv.title ?? conv.contactId ?? `#${conv.id.slice(0, 6)}`;
}

/* ------------------------------------------------------------------ */
/*  Conversation List Item                                             */
/* ------------------------------------------------------------------ */

function ConvListItem({
  conv,
  selected,
  onClick,
}: {
  conv: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  const color = channelColor(conv.channel);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left border-b transition-colors',
        selected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-muted/50',
      )}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white mt-0.5"
        style={{ background: color }}
      >
        <ChannelIcon channel={conv.channel} size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate">{convDisplayName(conv)}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelative(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {conv.lastMessage ?? <em>No messages</em>}
          </span>
          {(conv.unreadCount ?? 0) > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {conv.unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
            style={{ background: color }}
          >
            {channelLabel(conv.channel)}
          </span>
          <StatusBadge status={conv.status} />
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Message Bubble                                                     */
/* ------------------------------------------------------------------ */

function MessageBubble({ msg, channel }: { msg: ConvMessage; channel: string }) {
  const isUser = msg.authorType === 'human';
  const isAi = msg.isAiGenerated;
  const color = channelColor(channel);

  return (
    <div className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white mt-0.5"
        style={{ background: isUser ? '#64748b' : isAi ? '#6366f1' : color }}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : isAi ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <ChannelIcon channel={channel} size={16} />
        )}
      </div>

      <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">{msg.author}</span>
          {isAi && (
            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20 font-medium">
              <Sparkles className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {msg.timestamp && (
            <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
          )}
        </div>
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : isAi
              ? 'bg-violet-500/5 text-foreground rounded-tl-sm border border-violet-500/20'
              : 'bg-muted text-foreground rounded-tl-sm',
          )}
          style={!isUser && !isAi ? { borderLeft: `3px solid ${color}` } : undefined}
        >
          {msg.text || <span className="italic text-muted-foreground/60">(empty)</span>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Raw message from API (ConversationMessage model)                   */
/* ------------------------------------------------------------------ */

interface RawMessage {
  id: string;
  content?: string | null;
  role?: string;
  authorId?: string | null;
  authorName?: string | null;
  authorType?: string;
  isAiGenerated?: boolean;
  createdAt?: string;
}

function rawToConvMessage(raw: RawMessage, channel: string): ConvMessage {
  return {
    id: raw.id,
    text: raw.content ?? '',
    author: raw.authorName ?? raw.authorId ?? (raw.authorType === 'human' ? 'You' : 'Agent'),
    authorId: raw.authorId ?? '',
    authorType: raw.authorType ?? raw.role ?? 'human',
    isAiGenerated: raw.isAiGenerated ?? false,
    channel,
    timestamp: raw.createdAt ?? new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Conversation Thread                                                */
/* ------------------------------------------------------------------ */

function ConversationThread({
  conv,
  onStatusChange,
  onAutoRespondChange,
}: {
  conv: Conversation;
  onStatusChange: (id: string, status: string) => void;
  onAutoRespondChange: (id: string, enabled: boolean) => void;
}) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [togglingAutoRespond, setTogglingAutoRespond] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const color = channelColor(conv.channel);

  async function handleToggleAutoRespond() {
    setTogglingAutoRespond(true);
    try {
      await api.patch(`/api/v1/conversations/${conv.id}/auto-respond`, {
        autoRespond: !conv.autoRespond,
      });
      onAutoRespondChange(conv.id, !conv.autoRespond);
    } catch {
      // ignore — optimistic update not applied
    } finally {
      setTogglingAutoRespond(false);
    }
  }

  useEffect(() => {
    setLoadingMsgs(true);
    api
      .get<{ messages: RawMessage[] }>(`/api/v1/conversations/${conv.id}/history`)
      .then((data) => {
        const msgs = (data.messages ?? []).map((m) => rawToConvMessage(m, conv.channel));
        setMessages(msgs);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [conv.id, conv.channel]);

  const wsChannel = `conversations:${conv.id}`;
  const { connected } = useChatWebSocket(wsChannel, (msg: ChatMessage) => {
    setMessages((prev) => [
      ...prev,
      {
        id: msg.id,
        text: msg.text,
        author: msg.author,
        authorId: msg.authorId,
        authorType: msg.authorType,
        channel: msg.channel,
        timestamp: msg.timestamp ?? new Date().toISOString(),
      },
    ]);
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const message = await api.post<RawMessage>(`/api/v1/conversations/${conv.id}/messages`, {
        content: text,
        role: 'user',
        authorType: 'human',
      });
      setMessages((prev) => [...prev, rawToConvMessage(message, conv.channel)]);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  const nextStatus = conv.status === 'OPEN' || conv.status === 'open' ? 'RESOLVED' : 'OPEN';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: color }}
          >
            <ChannelIcon channel={conv.channel} size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold">{convDisplayName(conv)}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {channelLabel(conv.channel)}
              {conv.agentName ? ` · ${conv.agentName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn('w-2 h-2 rounded-full', connected ? 'bg-green-500' : 'bg-slate-400')}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <StatusBadge status={conv.status} />
          <Button
            variant={conv.autoRespond ? 'default' : 'outline'}
            size="sm"
            className={cn('h-7 text-xs gap-1', conv.autoRespond && 'bg-violet-600 hover:bg-violet-700 text-white border-transparent')}
            onClick={handleToggleAutoRespond}
            disabled={togglingAutoRespond}
            title={conv.autoRespond ? 'Auto-respond ON — click to disable' : 'Auto-respond OFF — click to enable'}
          >
            {conv.autoRespond ? (
              <><Zap className="h-3 w-3" />Auto</>
            ) : (
              <><ZapOff className="h-3 w-3" />Auto</>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onStatusChange(conv.id, nextStatus)}
          >
            {conv.status === 'OPEN' || conv.status === 'open' ? (
              <>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Resolve
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5 mr-1" />
                Reopen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {loadingMsgs ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn('flex gap-2.5', i % 2 === 0 ? 'flex-row' : 'flex-row-reverse')}>
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <Skeleton className={cn('h-12 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-36')} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} channel={conv.channel} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-5 py-4 border-t">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Reply via ${channelLabel(conv.channel)}...`}
            disabled={sending}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('OPEN');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(
    async (q: string, ch: string, st: string) => {
      try {
        const params = new URLSearchParams();
        if (q) params.set('search', q);
        if (ch) params.set('channel', ch);
        if (st) params.set('status', st);

        const data = await api.get<{ items: Conversation[] }>(
          `/api/v1/conversations?${params.toString()}`,
        );
        setConversations(data.items ?? []);
      } catch {
        setConversations([]);
      }
    },
    [],
  );

  useEffect(() => {
    fetchConversations('', '', 'OPEN').finally(() => setLoading(false));
  }, [fetchConversations]);

  useEffect(() => {
    if (loading) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchConversations(search, channel, status);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, channel, status]);

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await api.post(`/api/v1/conversations/${id}/transition`, { status: newStatus });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
      );
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch {
      // ignore
    }
  }

  function handleSelect(conv: Conversation) {
    setSelected(conv);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
    );
  }

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 lg:-m-6 overflow-hidden">
      {/* ---- Left sidebar ---- */}
      <div className="w-80 shrink-0 flex flex-col border-r bg-card/30 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">Conversations</h1>
            {totalUnread > 0 && (
              <Badge variant="default" className="ml-auto text-[10px] px-1.5 py-0 h-5">
                {totalUnread}
              </Badge>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Channel filter */}
          <div className="flex gap-1 flex-wrap">
            {CHANNEL_FILTER_OPTIONS.map((ch) => (
              <button
                key={ch.value}
                onClick={() => setChannel(ch.value)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  channel === ch.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-input hover:bg-muted/50',
                )}
              >
                {ch.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex gap-1 mt-1 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  status === s.value
                    ? 'bg-secondary text-secondary-foreground border-secondary-foreground/20'
                    : 'border-input hover:bg-muted/50',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 border-b">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">No conversations</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || channel || status ? 'Try adjusting filters' : 'Conversations will appear here'}
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <ConvListItem
                key={conv.id}
                conv={conv}
                selected={selected?.id === conv.id}
                onClick={() => handleSelect(conv)}
              />
            ))
          )}
        </div>
      </div>

      {/* ---- Right panel ---- */}
      <div className="flex-1 min-w-0 bg-background">
        {selected ? (
          <ConversationThread
            key={selected.id}
            conv={selected}
            onStatusChange={handleStatusChange}
            onAutoRespondChange={(id, enabled) => {
              setConversations((prev) =>
                prev.map((c) => (c.id === id ? { ...c, autoRespond: enabled } : c)),
              );
              if (selected?.id === id) {
                setSelected((prev) => (prev ? { ...prev, autoRespond: enabled } : null));
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <p className="font-medium">Select a conversation</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Choose a conversation from the left panel to view messages and reply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
