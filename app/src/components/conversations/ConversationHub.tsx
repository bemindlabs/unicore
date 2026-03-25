'use client';

import { useState, useCallback } from 'react';
import { Badge, Button } from '@bemindlabs/unicore-ui';
import {
  useConversationWebSocket,
  type ConversationEntry,
  type ConversationEvent,
} from '@/hooks/use-conversation-ws';

interface ConversationHubProps {
  agentId: string;
  agentName: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-500/20 text-green-400 border-green-500/30',
  ASSIGNED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RESOLVED: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
  CLOSED: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function ConversationHub({ agentId, agentName }: ConversationHubProps) {
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const handleEvent = useCallback((event: ConversationEvent) => {
    const p = event.payload;

    switch (event.type) {
      case 'conversation:new':
        setConversations((prev) => {
          if (prev.some((c) => c.id === (p.conversationId as string))) return prev;
          return [
            {
              id: p.conversationId as string,
              agentId: p.agentId as string,
              userId: p.userId as string,
              userChannel: p.channel as string,
              status: 'OPEN',
            },
            ...prev,
          ];
        });
        break;

      case 'conversation:message':
        setConversations((prev) =>
          prev.map((c) =>
            c.id === (p.conversationId as string)
              ? { ...c, lastMessage: p.text as string, lastMessageAt: event.timestamp, isTyping: false }
              : c,
          ),
        );
        break;

      case 'conversation:assigned':
        setConversations((prev) =>
          prev.map((c) =>
            c.id === (p.conversationId as string)
              ? {
                  ...c,
                  status: 'ASSIGNED',
                  assignedTo: p.assignedTo as string,
                  assignedToName: p.assignedToName as string,
                }
              : c,
          ),
        );
        break;

      case 'conversation:typing':
        setConversations((prev) =>
          prev.map((c) =>
            c.id === (p.conversationId as string)
              ? { ...c, isTyping: p.isTyping as boolean }
              : c,
          ),
        );
        break;
    }
  }, []);

  const { connected, sendConversationAssigned } = useConversationWebSocket(agentId, handleEvent);

  const selectedConv = conversations.find((c) => c.id === selected);

  return (
    <div className="flex flex-col h-full bg-[var(--bo-bg-deep,#0a0a0f)] text-[var(--bo-text-primary,#e2e8f0)] font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--bo-text-info,#94a3b8)]">
            Conversations
          </span>
          <span className="text-xs text-[var(--bo-text-muted,#64748b)]">/ {agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-[var(--bo-text-muted,#64748b)]">
            {connected ? 'live' : 'offline'}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5">
            {conversations.length}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversation list */}
        <div className="w-72 border-r border-white/10 flex flex-col overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-[10px] text-[var(--bo-text-muted,#64748b)]">
              No conversations yet.
              <br />
              Waiting for events…
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelected(conv.id)}
                className={`w-full text-left px-3 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                  selected === conv.id ? 'bg-white/10' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium truncate max-w-[140px]">
                    {conv.userId}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[conv.status] ?? STATUS_COLORS.OPEN}`}
                  >
                    {conv.status}
                  </span>
                </div>
                <div className="text-[9px] text-[var(--bo-text-muted,#64748b)] truncate">
                  {conv.isTyping ? (
                    <span className="text-blue-400 animate-pulse">typing…</span>
                  ) : (
                    conv.lastMessage ?? `via ${conv.userChannel}`
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {selectedConv ? (
            <div className="w-full max-w-md space-y-4">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--bo-text-muted,#64748b)]">ID</span>
                  <span className="font-mono text-[10px] truncate max-w-[240px]">{selectedConv.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--bo-text-muted,#64748b)]">User</span>
                  <span>{selectedConv.userId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--bo-text-muted,#64748b)]">Channel</span>
                  <span>{selectedConv.userChannel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--bo-text-muted,#64748b)]">Status</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[selectedConv.status] ?? ''}`}
                  >
                    {selectedConv.status}
                  </span>
                </div>
                {selectedConv.assignedToName && (
                  <div className="flex justify-between">
                    <span className="text-[var(--bo-text-muted,#64748b)]">Assigned to</span>
                    <span>{selectedConv.assignedToName}</span>
                  </div>
                )}
                {selectedConv.lastMessage && (
                  <div className="flex justify-between gap-4">
                    <span className="text-[var(--bo-text-muted,#64748b)] shrink-0">Last message</span>
                    <span className="text-right truncate max-w-[220px]">{selectedConv.lastMessage}</span>
                  </div>
                )}
              </div>
              {selectedConv.status === 'OPEN' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() =>
                    sendConversationAssigned(selectedConv.id, agentId, agentName)
                  }
                >
                  Assign to {agentName}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--bo-text-muted,#64748b)]">
              Select a conversation
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
