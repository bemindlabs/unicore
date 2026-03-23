'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  ExternalLink,
  MessageSquare,
  Hash,
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  GitMerge,
  X,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Badge,
  Textarea,
  Input,
  Separator,
  Skeleton,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ErpContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  type: string;
  leadScore?: number;
  tags?: string[];
}

interface AgentNote {
  id: string;
  contactId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface ContactChannel {
  id: string;
  contactId: string;
  channel: string;
  channelUserId: string;
  displayName?: string;
  isActive: boolean;
  createdAt: string;
}

interface ConversationSummary {
  id: string;
  title?: string;
  status: string;
  channel: string;
  assigneeName?: string;
  createdAt: string;
  _count: { messages: number };
}

interface ContactProfile {
  contact: ErpContact;
  channels: ContactChannel[];
  notes: AgentNote[];
  conversationHistory: ConversationSummary[];
}

interface MergeCandidate {
  id: string;
  name: string;
  email?: string;
  company?: string;
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
    return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈',
  line: '💬',
  web: '🌐',
  api: '⚡',
  command: '🖥',
  email: '✉',
  whatsapp: '📱',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-green-500/15 text-green-700 dark:text-green-400',
  ASSIGNED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PENDING: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  RESOLVED: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  CLOSED: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
      {icon}
      {title}
    </div>
  );
}

function NoteItem({
  note,
  currentUserId,
  onEdit,
  onDelete,
}: {
  note: AgentNote;
  currentUserId: string;
  onEdit: (note: AgentNote) => void;
  onDelete: (noteId: string) => void;
}) {
  const isOwn = note.authorId === currentUserId;
  return (
    <div className="group rounded-lg border bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap flex-1">{note.body}</p>
        {isOwn && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onEdit(note)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Edit note"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              title="Delete note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="font-medium">{note.authorName}</span>
        <span>·</span>
        <span>{formatRelative(note.createdAt)}</span>
        {note.updatedAt !== note.createdAt && <span className="italic">(edited)</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface ContactProfileSidebarProps {
  contactId: string | null;
  currentUserId: string;
  open: boolean;
  onClose: () => void;
}

export function ContactProfileSidebar({
  contactId,
  currentUserId,
  open,
  onClose,
}: ContactProfileSidebarProps) {
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note editing state
  const [noteText, setNoteText] = useState('');
  const [editingNote, setEditingNote] = useState<AgentNote | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // Merge state
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeResults, setMergeResults] = useState<MergeCandidate[]>([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const mergeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);

  const fetchProfile = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ContactProfile>(`/api/v1/contact-profile/${id}`);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contact profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && contactId) {
      fetchProfile(contactId);
    } else {
      setProfile(null);
      setError(null);
      setShowMerge(false);
      setNoteText('');
      setEditingNote(null);
    }
  }, [open, contactId, fetchProfile]);

  // WebSocket subscription for real-time note/channel updates
  useEffect(() => {
    if (!open || !contactId) return;

    const wsUrl =
      (process.env.NEXT_PUBLIC_CONTACT_PROFILE_WS_URL ?? 'ws://localhost:4001') +
      '/contact-profile';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'subscribe', data: { contactId } }));
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as { event: string; data: unknown };
        setProfile((prev) => {
          if (!prev) return prev;
          if (msg.event === 'note:created') {
            return { ...prev, notes: [msg.data as AgentNote, ...prev.notes] };
          }
          if (msg.event === 'note:updated') {
            const updated = msg.data as AgentNote;
            return {
              ...prev,
              notes: prev.notes.map((n) => (n.id === updated.id ? updated : n)),
            };
          }
          if (msg.event === 'note:deleted') {
            const { noteId } = msg.data as { noteId: string };
            return { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) };
          }
          if (msg.event === 'channel:updated') {
            const ch = msg.data as ContactChannel;
            const exists = prev.channels.find((c) => c.id === ch.id);
            return {
              ...prev,
              channels: exists
                ? prev.channels.map((c) => (c.id === ch.id ? ch : c))
                : [...prev.channels, ch],
            };
          }
          return prev;
        });
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [open, contactId]);

  // ----------------------------------------------------------------
  // Note handlers
  // ----------------------------------------------------------------

  async function handleSaveNote() {
    if (!contactId || !noteText.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        await api.put(`/api/v1/contact-profile/${contactId}/notes/${editingNote.id}`, {
          body: noteText.trim(),
        });
        // WS will update the list; optimistic update just in case
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                notes: prev.notes.map((n) =>
                  n.id === editingNote.id ? { ...n, body: noteText.trim() } : n,
                ),
              }
            : prev,
        );
        toast({ title: 'Note updated' });
      } else {
        await api.post(`/api/v1/contact-profile/${contactId}/notes`, { body: noteText.trim() });
        toast({ title: 'Note added' });
      }
      setNoteText('');
      setEditingNote(null);
    } catch (err) {
      toast({
        title: 'Failed to save note',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!contactId) return;
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/api/v1/contact-profile/${contactId}/notes/${noteId}`);
      setProfile((prev) =>
        prev ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) } : prev,
      );
      toast({ title: 'Note deleted' });
    } catch (err) {
      toast({
        title: 'Failed to delete note',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  // ----------------------------------------------------------------
  // Merge handlers
  // ----------------------------------------------------------------

  useEffect(() => {
    if (!showMerge || !mergeSearch.trim()) {
      setMergeResults([]);
      return;
    }
    if (mergeDebounceRef.current) clearTimeout(mergeDebounceRef.current);
    mergeDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<{ items: MergeCandidate[] }>(
          `/api/v1/contact-profile/search?q=${encodeURIComponent(mergeSearch)}`,
        );
        setMergeResults((data.items ?? []).filter((c) => c.id !== contactId));
      } catch {
        setMergeResults([]);
      }
    }, 350);
    return () => {
      if (mergeDebounceRef.current) clearTimeout(mergeDebounceRef.current);
    };
  }, [mergeSearch, showMerge, contactId]);

  async function handleMerge() {
    if (!contactId || selectedDuplicates.size === 0) return;
    if (
      !window.confirm(
        `Merge ${selectedDuplicates.size} duplicate(s) into this contact? The duplicates will be deleted.`,
      )
    )
      return;
    setMerging(true);
    try {
      await api.post('/api/v1/contact-profile/merge', {
        primaryId: contactId,
        duplicateIds: Array.from(selectedDuplicates),
      });
      toast({ title: 'Contacts merged successfully' });
      setShowMerge(false);
      setSelectedDuplicates(new Set());
      setMergeSearch('');
      await fetchProfile(contactId);
    } catch (err) {
      toast({
        title: 'Merge failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setMerging(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[400px] sm:w-[480px] overflow-y-auto p-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" />
              Contact Profile
            </SheetTitle>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        {loading && (
          <div className="p-5 space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-32" />
            <Separator />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {error && !loading && (
          <div className="p-5 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/70" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => contactId && fetchProfile(contactId)}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="p-5 space-y-5">
            {/* ── Contact info ── */}
            <section>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold leading-tight">{profile.contact.name}</h2>
                  {profile.contact.company && (
                    <p className="text-sm text-muted-foreground">{profile.contact.company}</p>
                  )}
                  {profile.contact.email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{profile.contact.email}</p>
                  )}
                  {profile.contact.phone && (
                    <p className="text-xs text-muted-foreground">{profile.contact.phone}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                  {profile.contact.type.toLowerCase()}
                </Badge>
              </div>
              {(profile.contact.leadScore ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Lead score</span>
                  <span className="text-xs font-semibold text-primary">{profile.contact.leadScore}</span>
                </div>
              )}
              <a
                href={`/erp/contacts/${profile.contact.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in CRM
              </a>
            </section>

            <Separator />

            {/* ── Connected channels ── */}
            <section>
              <SectionHeader icon={<Hash className="h-3.5 w-3.5" />} title="Connected Channels" />
              {profile.channels.length === 0 ? (
                <p className="text-xs text-muted-foreground">No channels linked.</p>
              ) : (
                <ul className="space-y-1.5">
                  {profile.channels.map((ch) => (
                    <li
                      key={ch.id}
                      className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 border ${ch.isActive ? 'bg-muted/30' : 'opacity-50'}`}
                    >
                      <span className="text-base leading-none">{CHANNEL_ICONS[ch.channel] ?? '📡'}</span>
                      <span className="font-medium capitalize">{ch.channel}</span>
                      <span className="text-muted-foreground flex-1 truncate">{ch.displayName ?? ch.channelUserId}</span>
                      {!ch.isActive && <Badge variant="secondary" className="text-[9px]">inactive</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* ── Conversation history ── */}
            <section>
              <SectionHeader
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                title={`Conversation History (${profile.conversationHistory.length})`}
              />
              {profile.conversationHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">No conversations yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {profile.conversationHistory.map((conv) => (
                    <li key={conv.id} className="rounded-md border px-3 py-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate flex-1">
                          {conv.title || `${CHANNEL_ICONS[conv.channel] ?? '📡'} ${conv.channel}`}
                        </span>
                        <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-medium ${STATUS_COLORS[conv.status] ?? ''}`}>
                          {conv.status.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{conv._count.messages} msg{conv._count.messages !== 1 ? 's' : ''}</span>
                        {conv.assigneeName && <><span>·</span><span>{conv.assigneeName}</span></>}
                        <span>·</span>
                        <span>{formatRelative(conv.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            {/* ── Agent notes ── */}
            <section>
              <SectionHeader icon={<StickyNote className="h-3.5 w-3.5" />} title="Agent Notes" />

              {/* Note editor */}
              <div className="space-y-2 mb-3">
                <Textarea
                  value={noteText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value)}
                  placeholder={editingNote ? 'Edit note…' : 'Add a note…'}
                  className="text-xs min-h-[72px] resize-none"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void handleSaveNote();
                    }
                  }}
                />
                <div className="flex items-center gap-2 justify-end">
                  {editingNote && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setEditingNote(null); setNoteText(''); }}
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={!noteText.trim() || savingNote}
                    onClick={handleSaveNote}
                  >
                    {savingNote ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : editingNote ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {editingNote ? 'Save' : 'Add Note'}
                  </Button>
                </div>
              </div>

              {/* Notes list */}
              {profile.notes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {profile.notes.map((note) => (
                    <NoteItem
                      key={note.id}
                      note={note}
                      currentUserId={currentUserId}
                      onEdit={(n) => { setEditingNote(n); setNoteText(n.body); }}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              )}
            </section>

            <Separator />

            {/* ── Merge duplicates ── */}
            <section>
              <SectionHeader icon={<GitMerge className="h-3.5 w-3.5" />} title="Merge Duplicates" />
              {!showMerge ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setShowMerge(true)}
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Find &amp; Merge Duplicates
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Search for duplicate contacts. Selected contacts will be merged into this one.
                  </p>
                  <Input
                    placeholder="Search by name or email…"
                    value={mergeSearch}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMergeSearch(e.target.value)}
                    className="text-xs h-8"
                  />
                  {mergeResults.length > 0 && (
                    <ul className="space-y-1 border rounded-md divide-y text-xs">
                      {mergeResults.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/20">
                          <input
                            type="checkbox"
                            id={`merge-${c.id}`}
                            checked={selectedDuplicates.has(c.id)}
                            onChange={(e) => {
                              setSelectedDuplicates((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.id);
                                else next.delete(c.id);
                                return next;
                              });
                            }}
                            className="rounded"
                          />
                          <label htmlFor={`merge-${c.id}`} className="flex-1 cursor-pointer">
                            <span className="font-medium">{c.name}</span>
                            {c.email && <span className="text-muted-foreground ml-1.5">{c.email}</span>}
                            {c.company && <span className="text-muted-foreground ml-1.5">· {c.company}</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setShowMerge(false); setMergeSearch(''); setSelectedDuplicates(new Set()); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={selectedDuplicates.size === 0 || merging}
                      onClick={handleMerge}
                    >
                      {merging ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
                      Merge {selectedDuplicates.size > 0 ? `(${selectedDuplicates.size})` : ''}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
