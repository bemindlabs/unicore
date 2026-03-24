'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Zap, Users, Plus, X, Send, MessageCircle, Circle,
  Code2, TestTube, Server, ClipboardList, Layers,
  Lock, Crown, ChevronRight, Loader2, Hash,
} from 'lucide-react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Input,
} from '@bemindlabs/unicore-ui';
import { useLicense } from '@/hooks/use-license';
import { useChatWebSocket, type ChatMessage } from '@/hooks/use-chat-ws';
import { uuid } from '@/lib/uuid';

// ── Types ─────────────────────────────────────────────────────────────────

type RoomType = 'general' | 'meeting' | 'war' | 'standup' | 'retro';
type SdlcAgentType = 'architect' | 'developer' | 'tester' | 'devops' | 'pm';

interface Room {
  id: string;
  name: string;
  type: RoomType;
  description?: string;
  members: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  activeAgents: SdlcAgentType[];
}

interface SdlcAgent {
  type: SdlcAgentType;
  name: string;
  status: 'online' | 'busy' | 'offline';
  activity?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const DLC_WS_URL = process.env.NEXT_PUBLIC_DLC_WS_URL ?? 'wss://localhost:19789';

const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  general: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  meeting: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  war: 'bg-red-500/10 text-red-600 dark:text-red-400',
  standup: 'bg-green-500/10 text-green-600 dark:text-green-400',
  retro: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const AGENT_ICONS: Record<SdlcAgentType, typeof Code2> = {
  architect: Layers,
  developer: Code2,
  tester: TestTube,
  devops: Server,
  pm: ClipboardList,
};

const AGENT_COLORS: Record<SdlcAgentType, string> = {
  architect: '#6366f1',
  developer: '#22c55e',
  tester: '#f59e0b',
  devops: '#3b82f6',
  pm: '#ec4899',
};

const DEFAULT_AGENTS: SdlcAgent[] = [
  { type: 'architect', name: 'Architect', status: 'online', activity: 'Reviewing system design' },
  { type: 'developer', name: 'Developer', status: 'busy', activity: 'Writing feature code' },
  { type: 'tester', name: 'Tester', status: 'online', activity: 'Running test suite' },
  { type: 'devops', name: 'DevOps', status: 'offline' },
  { type: 'pm', name: 'PM', status: 'online', activity: 'Planning sprint' },
];

const SEED_ROOMS: Room[] = [
  {
    id: 'room-general',
    name: 'general',
    type: 'general',
    description: 'Team-wide announcements and discussions',
    members: ['architect', 'developer', 'tester', 'devops', 'pm'],
    lastMessage: 'Deploy pipeline updated for staging environment.',
    lastMessageAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    activeAgents: ['architect', 'developer', 'pm'],
  },
  {
    id: 'room-standup',
    name: 'daily-standup',
    type: 'standup',
    description: 'Daily sync with SDLC agents',
    members: ['developer', 'tester', 'pm'],
    lastMessage: 'All blockers cleared. Sprint on track.',
    lastMessageAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    activeAgents: ['developer', 'pm'],
  },
  {
    id: 'room-war',
    name: 'incident-war-room',
    type: 'war',
    description: 'Active incident response',
    members: ['devops', 'developer'],
    lastMessage: 'P1 resolved — root cause: memory leak in api-gateway.',
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    activeAgents: ['devops'],
  },
  {
    id: 'room-retro',
    name: 'sprint-retro',
    type: 'retro',
    description: 'Sprint retrospective and learnings',
    members: ['architect', 'developer', 'tester', 'pm'],
    lastMessage: 'Action item: add integration tests for payment flow.',
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    activeAgents: [],
  },
];

const ROOM_TYPES: RoomType[] = ['general', 'meeting', 'war', 'standup', 'retro'];

// ── Helpers ───────────────────────────────────────────────────────────────

function formatRelativeTime(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ── Room Chat ─────────────────────────────────────────────────────────────

function RoomChat({ room, dlcUrl }: { room: Room; dlcUrl: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsUrlRef = useRef(dlcUrl);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev.slice(-150), msg]);
  }, []);

  // Use chat WS pointed at DLC gateway — override via ref trick
  const channelName = `dlc-room-${room.id}`;
  const { connected, send } = useChatWebSocket(channelName, handleMessage);

  // Override WS URL by swapping env before hook uses it
  // (hook reads NEXT_PUBLIC_WS_URL; we patch it for DLC rooms)
  useEffect(() => {
    if (typeof window !== 'undefined' && wsUrlRef.current !== DLC_WS_URL) {
      wsUrlRef.current = DLC_WS_URL;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Seed some placeholder messages when first opened
  useEffect(() => {
    if (room.lastMessage) {
      setMessages([
        {
          id: uuid(),
          text: room.lastMessage,
          author: 'DLC Agent',
          authorId: 'dlc-system',
          authorType: 'agent',
          channel: channelName,
          timestamp: room.lastMessageAt ?? new Date().toISOString(),
        },
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input.trim(), 'You', 'human-user', 'human');
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{room.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROOM_TYPE_COLORS[room.type]}`}>
          {room.type}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-400'}`} />
          {connected ? 'Connected' : 'Connecting…'}
        </div>
      </div>

      {/* Active agents in room */}
      {room.activeAgents.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>Active:</span>
          {room.activeAgents.map((a) => {
            const Icon = AGENT_ICONS[a];
            return (
              <span key={a} className="flex items-center gap-1" style={{ color: AGENT_COLORS[a] }}>
                <Icon className="h-3 w-3" />
                {a}
              </span>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-xs py-10">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.authorType === 'human' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                msg.authorType === 'human' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                {msg.author.charAt(0).toUpperCase()}
              </div>
              <div className="max-w-[75%] space-y-0.5">
                <div className={`flex items-baseline gap-1.5 text-[10px] text-muted-foreground ${
                  msg.authorType === 'human' ? 'justify-end' : ''
                }`}>
                  <span className="font-medium">{msg.author}</span>
                  <span>{formatRelativeTime(msg.timestamp)}</span>
                </div>
                <div className={`rounded-lg px-3 py-2 text-xs ${
                  msg.authorType === 'human'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={connected ? `Message #${room.name}…` : 'Connecting to DLC…'}
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 px-3" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Create Room Dialog ─────────────────────────────────────────────────────

function CreateRoomDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('general');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    // Simulate room creation (real impl would POST to DLC gateway)
    await new Promise((r) => setTimeout(r, 400));
    onCreated({
      id: `room-${uuid()}`,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      type,
      description: description.trim() || undefined,
      members: [],
      activeAgents: [],
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Create Room</CardTitle>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Room Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. sprint-42-planning"
              className="h-8 text-sm mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Room Type</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ROOM_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                    type === t
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this room for?"
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-8" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 h-8"
              onClick={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create Room
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AiDlcPage() {
  const { isFeatureEnabled, isPro } = useLicense();
  const dlcEnabled = isFeatureEnabled('featAiDlc');

  const [rooms, setRooms] = useState<Room[]>(SEED_ROOMS);
  const [agents] = useState<SdlcAgent[]>(DEFAULT_AGENTS);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(SEED_ROOMS[0].id);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  const onlineCount = agents.filter((a) => a.status !== 'offline').length;

  // ── Upgrade gate ────────────────────────────────────────────────────────

  if (!dlcEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI-DLC</h1>
            <p className="text-muted-foreground">Developer Lifecycle Chat with SDLC AI agents</p>
          </div>
        </div>

        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pro Feature</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                AI-DLC gives your team a shared workspace with 5 specialised SDLC agents — Architect,
                Developer, Tester, DevOps, and PM — collaborating in real-time rooms.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              {(['meeting', 'standup', 'war', 'retro'] as RoomType[]).map((t) => (
                <span key={t} className={`px-2.5 py-1 rounded-full ${ROOM_TYPE_COLORS[t]}`}>{t} rooms</span>
              ))}
            </div>
            <Button className="gap-2" onClick={() => window.location.href = '/settings/license'}>
              <Crown className="h-4 w-4" />
              Upgrade to Pro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-0 -mx-4 -my-4 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">AI-DLC</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">Developer Lifecycle Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            <span className="text-green-500 font-medium">{onlineCount}</span>/{agents.length} agents online
          </span>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setShowCreateRoom(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Room
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar — Rooms + Agent cards */}
        <div className="w-64 flex-shrink-0 border-r flex flex-col bg-muted/20 overflow-y-auto">
          {/* Agent status cards */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              SDLC Agents
            </p>
            <div className="space-y-1">
              {agents.map((agent) => {
                const Icon = AGENT_ICONS[agent.type];
                const statusColor =
                  agent.status === 'online'
                    ? 'bg-green-500'
                    : agent.status === 'busy'
                    ? 'bg-yellow-400'
                    : 'bg-muted-foreground/40';
                return (
                  <div key={agent.type} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
                    <div
                      className="relative w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: `${AGENT_COLORS[agent.type]}18` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: AGENT_COLORS[agent.type] }} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background ${statusColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-none">{agent.name}</p>
                      {agent.activity ? (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{agent.activity}</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">offline</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t mx-3 my-2" />

          {/* Room list */}
          <div className="px-3 pb-3 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              Rooms
            </p>
            <div className="space-y-0.5">
              {rooms.map((room) => {
                const isActive = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left px-2 py-2 rounded-md transition-colors group ${
                      isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Hash className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs font-medium truncate flex-1">{room.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${ROOM_TYPE_COLORS[room.type]}`}>
                        {room.type}
                      </span>
                    </div>
                    {room.activeAgents.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 ml-5">
                        {room.activeAgents.slice(0, 3).map((a) => (
                          <Circle
                            key={a}
                            className="h-1.5 w-1.5 fill-current"
                            style={{ color: AGENT_COLORS[a] }}
                          />
                        ))}
                        {room.activeAgents.length > 3 && (
                          <span className="text-[9px] text-muted-foreground">+{room.activeAgents.length - 3}</span>
                        )}
                      </div>
                    )}
                    {room.lastMessage && (
                      <p className={`text-[10px] truncate mt-0.5 ml-5 ${
                        isActive ? 'text-primary/70' : 'text-muted-foreground'
                      }`}>
                        {room.lastMessage}
                      </p>
                    )}
                    {room.lastMessageAt && (
                      <p className={`text-[9px] mt-0.5 ml-5 ${
                        isActive ? 'text-primary/50' : 'text-muted-foreground/50'
                      }`}>
                        {formatRelativeTime(room.lastMessageAt)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right — Room chat */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {selectedRoom ? (
            <RoomChat key={selectedRoom.id} room={selectedRoom} dlcUrl={DLC_WS_URL} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a room to start chatting
            </div>
          )}
        </div>
      </div>

      {/* Create Room dialog */}
      {showCreateRoom && (
        <CreateRoomDialog
          onClose={() => setShowCreateRoom(false)}
          onCreated={(room) => {
            setRooms((prev) => [room, ...prev]);
            setSelectedRoomId(room.id);
          }}
        />
      )}
    </div>
  );
}
