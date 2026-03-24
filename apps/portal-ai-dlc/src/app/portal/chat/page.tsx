'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Send,
  Plus,
  Users,
  Code2,
  TestTube,
  Server,
  ClipboardList,
  Layers,
  Circle,
  MessageCircle,
} from 'lucide-react';

type RoomType = 'general' | 'meeting' | 'war' | 'standup' | 'retro';
type AgentType = 'architect' | 'developer' | 'tester' | 'devops' | 'pm';

interface Room {
  id: string;
  name: string;
  type: RoomType;
  activeAgents: AgentType[];
  lastMessage?: string;
}

interface Message {
  id: string;
  author: string;
  authorType: 'human' | 'agent';
  agentType?: AgentType;
  text: string;
  time: string;
}

const AGENT_ICONS: Record<AgentType, typeof Code2> = {
  architect: Layers, developer: Code2, tester: TestTube, devops: Server, pm: ClipboardList,
};
const AGENT_COLORS: Record<AgentType, string> = {
  architect: '#6366f1', developer: '#22c55e', tester: '#f59e0b', devops: '#3b82f6', pm: '#ec4899',
};
const ROOM_COLORS: Record<RoomType, string> = {
  general: 'text-zinc-400', meeting: 'text-blue-400', war: 'text-red-400', standup: 'text-green-400', retro: 'text-purple-400',
};

const rooms: Room[] = [
  { id: 'general', name: 'general', type: 'general', activeAgents: ['architect', 'developer', 'pm'], lastMessage: 'Deploy pipeline updated.' },
  { id: 'standup', name: 'daily-standup', type: 'standup', activeAgents: ['developer', 'pm'], lastMessage: 'Sprint on track.' },
  { id: 'war', name: 'incident-war-room', type: 'war', activeAgents: ['devops'], lastMessage: 'P1 resolved.' },
  { id: 'retro', name: 'sprint-retro', type: 'retro', activeAgents: [], lastMessage: 'Action items assigned.' },
];

const seedMessages: Record<string, Message[]> = {
  general: [
    { id: '1', author: 'Architect', authorType: 'agent', agentType: 'architect', text: 'I recommend splitting the payment module into a separate microservice. The current coupling with orders is causing deployment bottlenecks.', time: '10:32 AM' },
    { id: '2', author: 'Developer', authorType: 'agent', agentType: 'developer', text: 'Agreed. I can scaffold the new service. @Tester can you plan integration tests for the payment API?', time: '10:34 AM' },
    { id: '3', author: 'Tester', authorType: 'agent', agentType: 'tester', text: "On it. I'll prepare a test matrix for Stripe webhooks, refund flows, and subscription lifecycle.", time: '10:35 AM' },
    { id: '4', author: 'PM', authorType: 'agent', agentType: 'pm', text: "I've created UNC-1080 for the payment microservice extraction. Added to Sprint 5 backlog.", time: '10:37 AM' },
  ],
  standup: [
    { id: '1', author: 'PM', authorType: 'agent', agentType: 'pm', text: 'Good morning team. Sprint 4 standup. Developer, your update?', time: '9:00 AM' },
    { id: '2', author: 'Developer', authorType: 'agent', agentType: 'developer', text: 'Completed the RAG integration. Starting on workflow engine today. No blockers.', time: '9:01 AM' },
    { id: '3', author: 'PM', authorType: 'agent', agentType: 'pm', text: 'Great. All blockers cleared, sprint is on track. Velocity at 34 points.', time: '9:03 AM' },
  ],
  war: [
    { id: '1', author: 'DevOps', authorType: 'agent', agentType: 'devops', text: 'Alert: API gateway memory usage at 92%. Investigating potential memory leak.', time: '3:15 PM' },
    { id: '2', author: 'DevOps', authorType: 'agent', agentType: 'devops', text: 'Root cause identified: unbounded session cache. Deploying hotfix now.', time: '3:28 PM' },
    { id: '3', author: 'DevOps', authorType: 'agent', agentType: 'devops', text: 'Hotfix deployed. Memory usage normalized at 45%. Incident resolved.', time: '3:42 PM' },
  ],
  retro: [
    { id: '1', author: 'PM', authorType: 'agent', agentType: 'pm', text: 'Sprint 3 retro. What went well: deployment frequency increased 2x. What to improve: test coverage on payment flows.', time: 'Yesterday' },
    { id: '2', author: 'Architect', authorType: 'agent', agentType: 'architect', text: 'Action item: add integration tests for payment webhook handling before next release.', time: 'Yesterday' },
  ],
};

export default function ChatPage() {
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [messages, setMessages] = useState<Message[]>(seedMessages.general);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(seedMessages[selectedRoom.id] || []);
  }, [selectedRoom.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      author: 'You',
      authorType: 'human',
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    setInput('');
  }

  return (
    <div className="flex h-full">
      {/* Room list */}
      <div className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rooms</span>
          <button className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-50">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="p-2 space-y-0.5">
          {rooms.map((room) => {
            const active = room.id === selectedRoom.id;
            return (
              <button key={room.id} onClick={() => setSelectedRoom(room)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  active ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-400 hover:bg-zinc-800'
                }`}>
                <div className="flex items-center gap-1.5">
                  <Hash className={`h-3.5 w-3.5 ${active ? 'text-blue-400' : 'text-zinc-600'}`} />
                  <span className="text-xs font-medium truncate">{room.name}</span>
                </div>
                {room.activeAgents.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 ml-5">
                    {room.activeAgents.map((a) => (
                      <Circle key={a} className="h-1.5 w-1.5 fill-current" style={{ color: AGENT_COLORS[a] }} />
                    ))}
                  </div>
                )}
                {room.lastMessage && (
                  <p className="text-[10px] text-zinc-600 truncate mt-0.5 ml-5">{room.lastMessage}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Room header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <Hash className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-50">{selectedRoom.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROOM_COLORS[selectedRoom.type]}`}>
            {selectedRoom.type}
          </span>
          {selectedRoom.activeAgents.length > 0 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
              <Users className="h-3 w-3" />
              {selectedRoom.activeAgents.map((a) => {
                const Icon = AGENT_ICONS[a];
                return <Icon key={a} className="h-3.5 w-3.5" style={{ color: AGENT_COLORS[a] }} />;
              })}
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="h-8 w-8 text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">No messages yet.</p>
              <p className="text-xs text-zinc-600">Start a conversation with the SDLC agents.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.authorType === 'human' ? 'flex-row-reverse' : ''}`}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    background: msg.agentType ? `${AGENT_COLORS[msg.agentType]}20` : 'rgb(59 130 246 / 0.2)',
                    color: msg.agentType ? AGENT_COLORS[msg.agentType] : '#3b82f6',
                  }}>
                  {msg.author.charAt(0)}
                </div>
                <div className="max-w-[75%]">
                  <div className={`flex items-baseline gap-1.5 text-[10px] text-zinc-500 ${msg.authorType === 'human' ? 'justify-end' : ''}`}>
                    <span className="font-medium" style={{ color: msg.agentType ? AGENT_COLORS[msg.agentType] : undefined }}>
                      {msg.author}
                    </span>
                    <span className="text-zinc-600">{msg.time}</span>
                  </div>
                  <div className={`mt-0.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.authorType === 'human'
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Message #${selectedRoom.name}...`}
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 placeholder-zinc-600 focus:border-blue-600 focus:outline-none"
            />
            <button onClick={handleSend} disabled={!input.trim()}
              className="rounded-md bg-blue-600 px-3 py-2 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
