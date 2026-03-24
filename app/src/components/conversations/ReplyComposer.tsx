'use client';

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import {
  Send,
  Paperclip,
  Sparkles,
  ChevronDown,
  X,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import {
  Button,
  Textarea,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  cn,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { useChatWebSocket } from '@/hooks/use-chat-ws';
import { uuid } from '@/lib/uuid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ChannelType = 'web' | 'telegram' | 'line' | 'facebook' | 'instagram' | 'whatsapp' | 'slack' | 'discord';

export interface CannedResponse {
  id: string;
  shortcut: string;
  text: string;
  category?: string;
}

export interface ReplyComposerProps {
  /** Conversation / channel identifier for WebSocket routing */
  conversationId: string;
  /** Display name of the conversation contact */
  contactName?: string;
  /** Pre-select a channel (defaults to 'web') */
  defaultChannel?: ChannelType;
  /** Called after a message is successfully sent */
  onSent?: (text: string, channel: ChannelType, attachments: File[]) => void;
  /** Called when the user cancels / closes the composer */
  onCancel?: () => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Channel metadata                                                   */
/* ------------------------------------------------------------------ */

const CHANNEL_LABELS: Record<ChannelType, string> = {
  web: 'Web Chat',
  telegram: 'Telegram',
  line: 'LINE',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
  discord: 'Discord',
};

const CHANNEL_COLORS: Record<ChannelType, string> = {
  web: 'bg-blue-500',
  telegram: 'bg-sky-500',
  line: 'bg-green-500',
  facebook: 'bg-blue-700',
  instagram: 'bg-pink-500',
  whatsapp: 'bg-emerald-500',
  slack: 'bg-purple-600',
  discord: 'bg-indigo-500',
};

/* ------------------------------------------------------------------ */
/*  File attachment pill                                               */
/* ------------------------------------------------------------------ */

function AttachmentPill({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Paperclip className="h-3 w-3 shrink-0" />
      <span className="max-w-[120px] truncate">{file.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full hover:text-destructive focus:outline-none"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ReplyComposer({
  conversationId,
  contactName,
  defaultChannel = 'web',
  onSent,
  onCancel,
  className,
}: ReplyComposerProps) {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<ChannelType>(defaultChannel);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedLoading, setCannedLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCanned, setShowCanned] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* WebSocket for real-time channel */
  const wsChannel = `conversation-${conversationId}`;
  const { connected } = useChatWebSocket(wsChannel, () => {
    // incoming messages handled by parent
  });

  /* ---------------------------------------------------------------- */
  /*  Load canned responses on mount                                  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    setCannedLoading(true);
    api
      .get<{ items: CannedResponse[] }>('/api/v1/conversations/canned-responses?limit=50')
      .then((data) => setCannedResponses(data.items ?? []))
      .catch(() => setCannedResponses([]))
      .finally(() => setCannedLoading(false));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Auto-resize textarea                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  /* ---------------------------------------------------------------- */
  /*  AI suggestion                                                   */
  /* ---------------------------------------------------------------- */
  const handleAiSuggest = useCallback(async () => {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const data = await api.post<{ suggestion: string }>(
        '/api/v1/conversations/ai-suggest',
        { conversationId, currentText: text },
      );
      const suggestion = data.suggestion ?? '';
      setAiSuggestion(suggestion);
      setText(suggestion);
      textareaRef.current?.focus();
    } catch {
      // silently fail — AI suggestion is optional
    } finally {
      setAiLoading(false);
    }
  }, [conversationId, text]);

  /* ---------------------------------------------------------------- */
  /*  File attachment                                                 */
  /* ---------------------------------------------------------------- */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments((prev) => [...prev, ...files].slice(0, 5)); // max 5 files
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Canned response insert                                          */
  /* ---------------------------------------------------------------- */
  const insertCanned = useCallback((cr: CannedResponse) => {
    setText(cr.text);
    setShowCanned(false);
    textareaRef.current?.focus();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Send                                                            */
  /* ---------------------------------------------------------------- */
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (sending) return;

    setSending(true);
    try {
      // 1. Upload attachments (if any)
      const uploadedUrls: string[] = [];
      for (const file of attachments) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await api.post<{ url: string }>('/api/v1/conversations/upload', formData as any);
          if (res.url) uploadedUrls.push(res.url);
        } catch {
          // skip failed uploads
        }
      }

      // 2. Send the message via API (persists + routes to channel)
      await api.post('/api/v1/conversations/send', {
        conversationId,
        channel,
        text: trimmed,
        attachments: uploadedUrls,
        messageId: uuid(),
      });

      onSent?.(trimmed, channel, attachments);
      setText('');
      setAttachments([]);
      setAiSuggestion('');
    } finally {
      setSending(false);
    }
  }, [text, attachments, sending, channel, conversationId, onSent]);

  /* ---------------------------------------------------------------- */
  /*  Keyboard shortcut: Ctrl+Enter / Cmd+Enter                      */
  /* ---------------------------------------------------------------- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /* ---------------------------------------------------------------- */
  /*  Canned response trigger: type "/" at start of line             */
  /* ---------------------------------------------------------------- */
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    // Open canned responses when user types "/" at start
    if (val === '/' || val.startsWith('/')) {
      setShowCanned(true);
    } else {
      setShowCanned(false);
    }
  }, []);

  const filteredCanned = showCanned
    ? cannedResponses.filter((cr) =>
        text === '/'
          ? true
          : cr.shortcut.toLowerCase().includes(text.slice(1).toLowerCase()) ||
            cr.text.toLowerCase().includes(text.slice(1).toLowerCase()),
      )
    : [];

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !sending;

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border bg-background p-3 shadow-sm', className)}>
      {/* Header row: contact info + channel selector */}
      <div className="flex items-center justify-between gap-2">
        {contactName && (
          <span className="truncate text-sm font-medium text-foreground">
            Replying to <span className="text-primary">{contactName}</span>
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* WS connection indicator */}
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              connected ? 'bg-green-500' : 'bg-muted-foreground',
            )}
            title={connected ? 'Connected' : 'Reconnecting…'}
          />

          {/* Channel selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                <span className={cn('h-2 w-2 rounded-full', CHANNEL_COLORS[channel])} />
                {CHANNEL_LABELS[channel]}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-xs">Send via</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(CHANNEL_LABELS) as ChannelType[]).map((ch) => (
                <DropdownMenuItem
                  key={ch}
                  onSelect={() => setChannel(ch)}
                  className="gap-2 text-xs"
                >
                  <span className={cn('h-2 w-2 rounded-full', CHANNEL_COLORS[ch])} />
                  {CHANNEL_LABELS[ch]}
                  {ch === channel && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onCancel}
              aria-label="Close composer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Attachments row */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {attachments.map((file, i) => (
            <AttachmentPill key={i} file={file} onRemove={() => removeAttachment(i)} />
          ))}
        </div>
      )}

      {/* Canned response picker */}
      {showCanned && filteredCanned.length > 0 && (
        <div className="rounded-md border bg-popover shadow-md">
          <div className="p-1 text-xs font-medium text-muted-foreground px-2 pt-2">
            Canned responses
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filteredCanned.map((cr) => (
              <button
                key={cr.id}
                type="button"
                onClick={() => insertCanned(cr)}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <span className="text-xs font-medium text-primary">/{cr.shortcut}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{cr.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI suggestion accepted banner */}
      {aiSuggestion && aiSuggestion === text && (
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
          <Sparkles className="h-3 w-3" />
          AI suggestion applied — edit freely
        </div>
      )}

      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={`Type a message… (type / for canned responses, Ctrl+Enter to send)`}
        className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        rows={3}
        disabled={sending}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-t pt-2">
        {/* File attachment */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending || attachments.length >= 5}
          title="Attach file (max 5)"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Canned responses button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setText('/');
            setShowCanned(true);
            textareaRef.current?.focus();
          }}
          disabled={sending || cannedLoading}
          title="Canned responses (/)"
          aria-label="Canned responses"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        {/* AI suggestion */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleAiSuggest}
          disabled={sending || aiLoading}
          title="AI-suggested reply"
          aria-label="AI suggestion"
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Suggest</span>
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Send */}
        <Button
          size="sm"
          className="h-8 gap-1.5 px-3"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span>Send</span>
          <Badge variant="secondary" className="ml-1 hidden h-4 px-1 text-[10px] sm:flex">
            ⌃↵
          </Badge>
        </Button>
      </div>
    </div>
  );
}
