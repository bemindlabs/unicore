'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageCircle, X, Minimize2 } from 'lucide-react';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';

const CHANNEL = 'chat-backoffice';

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

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-99), msg]); // Keep last 100
    if (!open) setUnread((n) => n + 1);
  }, [open]);

  const { connected, send } = useChatWebSocket(CHANNEL, handleMessage);

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
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Team Chat</span>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-muted'}`} />
        </div>
        <div className="flex gap-1">
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
            No messages yet. Start the conversation!
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
            placeholder={connected ? 'Type a message...' : 'Connecting...'}
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
