'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Bot,
  User,
  Clock,
  Filter,
  MessagesSquare,
  UserCircle,
} from 'lucide-react';
import { toast, Badge, Button, Input, Skeleton } from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { getAgents } from '@/lib/agents/store';
import type { VirtualOfficeAgent } from '@/lib/agents/types';
import { ConversationIntelligenceSidebar } from '@/components/chat-intelligence/ConversationIntelligenceSidebar';
import { useIntelligenceStream } from '@/hooks/use-intelligence-stream';
import { ContactProfileSidebar } from '@/components/conversations/contact-profile-sidebar';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string;
  text: string;
  author: string;
  authorId: string;
  authorColor?: string;
  timestamp: string;
}

interface ChatHistoryRecord {
  id: string;
  agentId: string;
  agentName: string;
  userId: string;
  userName: string;
  messages: ChatMessage[];
  summary: string | null;
  channel: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const AGENT_COLORS: Record<string, string> = {
  router: '#06b6d4',
  finance: '#f59e0b',
  growth: '#10b981',
  ops: '#8b5cf6',
  research: '#ec4899',
};

function agentColor(agentId: string, agents: VirtualOfficeAgent[]): string {
  const agent = agents.find((a) => a.id === agentId);
  return agent?.color ?? AGENT_COLORS[agentId] ?? '#64748b';
}

function agentInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const CHANNEL_LABELS: Record<string, string> = {
  command: 'Commander',
  telegram: 'Telegram',
  line: 'LINE',
  web: 'Web',
  api: 'API',
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <div className="border rounded-lg bg-card/50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  msg: ChatMessage;
  agentColor: string;
  agentName: string;
}

function MessageBubble({ msg, agentColor: color, agentName }: MessageBubbleProps) {
  const isUser = msg.authorId === 'human-user' || msg.authorId === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white mt-0.5"
        style={{ background: isUser ? '#64748b' : color }}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">
            {isUser ? (msg.author || 'You') : (msg.author || agentName)}
          </span>
          {msg.timestamp && (
            <span className="text-[9px] text-muted-foreground/50">{formatTime(msg.timestamp)}</span>
          )}
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          }`}
          style={!isUser ? { borderLeft: `3px solid ${color}` } : undefined}
        >
          {msg.text || <span className="italic text-muted-foreground/60">(empty)</span>}
        </div>
      </div>
    </div>
  );
}

function IntelligencePanel({ chatHistoryId }: { chatHistoryId: string }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
  }, []);
  const { intelligence, loading, refresh } = useIntelligenceStream(chatHistoryId, token);
  return (
    <ConversationIntelligenceSidebar
      intelligence={intelligence}
      loading={loading}
      onRefresh={refresh}
    />
  );
}

interface ConversationRowProps {
  record: ChatHistoryRecord;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onOpenProfile: (userName: string) => void;
  agents: VirtualOfficeAgent[];
  deleting: boolean;
}

function ConversationRow({ record, expanded, onToggle, onDelete, onOpenProfile, agents, deleting }: ConversationRowProps) {
  const color = agentColor(record.agentId, agents);
  const msgCount = Array.isArray(record.messages) ? record.messages.length : 0;
  const preview =
    record.summary ||
    (Array.isArray(record.messages) && record.messages.length > 0
      ? record.messages.find((m) => m.authorId === 'human-user' || m.authorId === 'user')?.text?.slice(0, 120) ??
        record.messages[0].text?.slice(0, 120)
      : null);
  const channelLabel = CHANNEL_LABELS[record.channel] ?? record.channel;

  return (
    <div className={`border rounded-xl bg-card overflow-hidden transition-shadow ${expanded ? 'shadow-md' : 'hover:shadow-sm'}`}>
      {/* Colored left accent */}
      <div className="flex">
        <div className="w-1 shrink-0 rounded-l-xl" style={{ background: color }} />

        <div className="flex-1 min-w-0">
          {/* Row header */}
          <button
            onClick={onToggle}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
          >
            {/* Chevron */}
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}

            {/* Agent avatar */}
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: color }}
            >
              {agentInitials(record.agentName) || <Bot className="h-4 w-4" />}
            </div>

            {/* Agent name + channel */}
            <div className="flex flex-col min-w-[90px] shrink-0">
              <span className="text-sm font-semibold leading-tight">{record.agentName}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{channelLabel}</span>
            </div>

            {/* Preview */}
            <span className="flex-1 text-xs text-muted-foreground truncate hidden sm:block">
              {preview ?? <em>No messages</em>}
            </span>

            {/* Meta */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {msgCount} msg{msgCount !== 1 ? 's' : ''}
              </Badge>
              <span
                className="text-xs text-muted-foreground"
                title={formatAbsolute(record.createdAt)}
              >
                <Clock className="inline h-3 w-3 mr-0.5 -mt-0.5" />
                {formatRelative(record.createdAt)}
              </span>
            </div>
          </button>

          {/* Expanded panel */}
          {expanded && (
            <div className="border-t bg-muted/5">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/10">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <User className="inline h-3 w-3 mr-1 -mt-0.5" />
                    {record.userName || 'Unknown user'}
                  </span>
                  <span>·</span>
                  <span title={formatAbsolute(record.createdAt)}>{formatAbsolute(record.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile(record.userName);
                    }}
                  >
                    <UserCircle className="h-3 w-3" />
                    Contact Profile
                  </Button>
                  <a
                    href={`${process.env.NEXT_PUBLIC_VIRTUAL_OFFICE_URL ?? 'https://vo-unicore-demo.bemind.tech'}?agent=${record.agentId}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-primary/10 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Continue in Virtual Office
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    disabled={deleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(record.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Messages + Intelligence */}
              <div className="px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Messages — takes 2/3 */}
                <div className="lg:col-span-2">
                  {Array.isArray(record.messages) && record.messages.length > 0 ? (
                    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                      {record.messages.map((msg, idx) => (
                        <MessageBubble
                          key={msg.id ?? idx}
                          msg={msg}
                          agentColor={color}
                          agentName={record.agentName}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No messages in this conversation.
                    </p>
                  )}
                </div>

                {/* Intelligence sidebar — 1/3 */}
                <div className="lg:col-span-1">
                  <IntelligencePanel chatHistoryId={record.id} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChatHistoryPage() {
  const [records, setRecords] = useState<ChatHistoryRecord[]>([]);
  const [agents, setAgents] = useState<VirtualOfficeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contact profile sidebar
  const [profileContactId, setProfileContactId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // Current user id — loaded from JWT stored in localStorage
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    // Decode userId from stored JWT (header.payload.sig — payload is base64url)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        setCurrentUserId((payload as { sub?: string; id?: string }).sub ?? (payload as { sub?: string; id?: string }).id ?? '');
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchData = useCallback(async (search: string, agent: string) => {
    try {
      const params = new URLSearchParams();
      if (agent) params.set('agentId', agent);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const data = await api.get<{ items: ChatHistoryRecord[] }>(
        `/api/v1/chat-history?${params.toString()}`,
      );
      setRecords(data.items ?? []);
    } catch {
      setRecords([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchData('', ''),
      getAgents().then(({ agents: list }) => setAgents(list)),
    ]).finally(() => setLoading(false));
  }, [fetchData]);

  // Debounced re-fetch on filter change
  useEffect(() => {
    if (loading) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchData(searchText, filterAgent);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, filterAgent]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/api/v1/chat-history/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({ title: 'Conversation deleted' });
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleOpenProfile(userName: string) {
    // Search ERP contacts by userName to resolve the contactId
    try {
      const data = await api.get<{ items: Array<{ id: string; name: string }> }>(
        `/api/v1/contact-profile/search?q=${encodeURIComponent(userName)}`,
      );
      const results = data.items ?? [];
      if (results.length === 0) {
        toast({
          title: 'No contact found',
          description: `No CRM contact matching "${userName}".`,
          variant: 'destructive',
        });
        return;
      }
      // Use the first (best) match
      setProfileContactId(results[0].id);
      setProfileOpen(true);
    } catch {
      toast({
        title: 'Could not load contact',
        description: 'Make sure the ERP service is running.',
        variant: 'destructive',
      });
    }
  }

  // Unique agent options for filter dropdown
  const agentOptions = Array.from(
    new Map(records.map((r) => [r.agentId, r.agentName])).entries(),
  );
  for (const a of agents) {
    if (!agentOptions.find(([id]) => id === a.id)) {
      agentOptions.push([a.id, a.name]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MessagesSquare className="h-6 w-6 text-primary" />
            Chat History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and search past conversations with AI agents.
          </p>
        </div>
        {!loading && records.length > 0 && (
          <Badge variant="outline" className="text-xs mt-1">
            {records.length} conversation{records.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="w-full sm:w-auto rounded-md border border-input bg-background pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="">All Agents</option>
            {agentOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-medium text-sm mb-1">
            {searchText || filterAgent ? 'No conversations match your filters' : 'No conversations yet'}
          </p>
          <p className="text-muted-foreground text-xs max-w-xs">
            {searchText || filterAgent
              ? 'Try adjusting your search or filter.'
              : 'Start chatting with agents in the Commander and your history will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <ConversationRow
              key={record.id}
              record={record}
              expanded={expandedIds.has(record.id)}
              onToggle={() => toggleExpand(record.id)}
              onDelete={handleDelete}
              onOpenProfile={handleOpenProfile}
              agents={agents}
              deleting={deletingIds.has(record.id)}
            />
          ))}
        </div>
      )}

      {/* Contact profile sidebar */}
      <ContactProfileSidebar
        contactId={profileContactId}
        currentUserId={currentUserId}
        open={profileOpen}
        onClose={() => { setProfileOpen(false); setProfileContactId(null); }}
      />
    </div>
  );
}
