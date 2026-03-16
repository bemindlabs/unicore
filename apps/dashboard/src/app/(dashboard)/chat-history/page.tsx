'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from '@unicore/ui';
import { api } from '@/lib/api';
import { getAgents } from '@/lib/backoffice/store';
import type { BackofficeAgent } from '@/lib/backoffice/types';

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

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
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

const AGENT_COLORS: Record<string, string> = {
  router: '#06b6d4',
  finance: '#f59e0b',
  growth: '#10b981',
  ops: '#8b5cf6',
  research: '#ec4899',
};

function agentColor(agentId: string, agents: BackofficeAgent[]): string {
  const agent = agents.find((a) => a.id === agentId);
  return agent?.color ?? AGENT_COLORS[agentId] ?? '#64748b';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatHistoryPage() {
  const [records, setRecords] = useState<ChatHistoryRecord[]>([]);
  const [agents, setAgents] = useState<BackofficeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set('agentId', filterAgent);
      if (searchText) params.set('search', searchText);
      params.set('limit', '100');

      const data = await api.get<{ items: ChatHistoryRecord[] }>(
        `/api/v1/chat-history?${params.toString()}`,
      );
      setRecords(data.items);
    } catch {
      // API unavailable — show empty state
      setRecords([]);
    }
  }, [filterAgent, searchText]);

  useEffect(() => {
    Promise.all([
      fetchData(),
      getAgents().then(({ agents: list }) => setAgents(list)),
    ]).finally(() => setLoading(false));
  }, [fetchData]);

  // Re-fetch when filters change
  useEffect(() => {
    if (!loading) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAgent, searchText]);

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/v1/chat-history/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      toast({ title: 'Failed to delete', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // Unique agent IDs from records for dropdown
  const agentOptions = Array.from(
    new Map(records.map((r) => [r.agentId, r.agentName])).entries(),
  );

  // Also include agents from the store that may not have records yet
  for (const a of agents) {
    if (!agentOptions.find(([id]) => id === a.id)) {
      agentOptions.push([a.id, a.name]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          Chat History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and search past conversations with AI agents.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Agents</option>
          {agentOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">No conversations yet. Start chatting with agents in the Commander.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            const color = agentColor(record.agentId, agents);
            const msgCount = Array.isArray(record.messages) ? record.messages.length : 0;
            const preview =
              record.summary ||
              (Array.isArray(record.messages) && record.messages.length > 0
                ? record.messages[0].text?.slice(0, 100)
                : 'No messages');

            return (
              <div
                key={record.id}
                className="border rounded-lg bg-card/50 overflow-hidden"
              >
                {/* Row header */}
                <button
                  onClick={() => toggleExpand(record.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-sm font-medium truncate min-w-[100px]">
                    {record.agentName}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(record.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    {msgCount} msg{msgCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex-1 text-xs text-muted-foreground truncate">
                    {preview}
                  </span>
                </button>

                {/* Expanded transcript */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                    {/* Actions */}
                    <div className="flex gap-2 justify-end">
                      <a
                        href={`/backoffice?agent=${record.agentId}`}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Continue in Commander
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(record.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>

                    {/* Messages */}
                    {Array.isArray(record.messages) && record.messages.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {record.messages.map((msg, idx) => {
                          const isUser = msg.authorId === 'human-user';
                          return (
                            <div
                              key={msg.id ?? idx}
                              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-[75%] ${isUser ? 'text-right' : 'text-left'}`}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  {!isUser && msg.authorColor && (
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{ background: msg.authorColor }}
                                    />
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {isUser ? 'You' : msg.author}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {msg.timestamp
                                      ? new Date(msg.timestamp).toLocaleTimeString(undefined, {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : ''}
                                  </span>
                                </div>
                                <div
                                  className={`inline-block rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                                    isUser
                                      ? 'bg-primary/10 text-foreground'
                                      : 'bg-muted text-foreground/80'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No messages in this conversation.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
