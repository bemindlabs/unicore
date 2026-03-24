'use client';

import Link from 'next/link';
import {
  Zap,
  MessageCircle,
  Users,
  Activity,
  Code2,
  TestTube,
  Server,
  ClipboardList,
  Layers,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

const agents = [
  { type: 'architect', name: 'Architect', icon: Layers, color: '#6366f1', status: 'online', activity: 'Reviewing system design' },
  { type: 'developer', name: 'Developer', icon: Code2, color: '#22c55e', status: 'busy', activity: 'Writing feature code' },
  { type: 'tester', name: 'Tester', icon: TestTube, color: '#f59e0b', status: 'online', activity: 'Running test suite' },
  { type: 'devops', name: 'DevOps', icon: Server, color: '#3b82f6', status: 'offline', activity: undefined },
  { type: 'pm', name: 'PM', icon: ClipboardList, color: '#ec4899', status: 'online', activity: 'Planning sprint' },
];

const recentConversations = [
  { id: 1, room: 'general', lastMessage: 'Deploy pipeline updated for staging environment.', agents: ['architect', 'developer'], time: '5m ago' },
  { id: 2, room: 'daily-standup', lastMessage: 'All blockers cleared. Sprint on track.', agents: ['developer', 'pm'], time: '25m ago' },
  { id: 3, room: 'incident-war-room', lastMessage: 'P1 resolved — root cause: memory leak.', agents: ['devops'], time: '2h ago' },
  { id: 4, room: 'sprint-retro', lastMessage: 'Action item: add integration tests.', agents: ['architect', 'tester', 'pm'], time: '1d ago' },
];

const stats = {
  totalMessages: 1_247,
  totalRooms: 8,
  agentsOnline: 4,
  tokensUsed: 842_500,
};

export default function DashboardPage() {
  const onlineCount = agents.filter((a) => a.status !== 'offline').length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-400">Developer Lifecycle Chat overview</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <MessageCircle className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{stats.totalMessages.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Messages</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Users className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{stats.totalRooms}</p>
          <p className="text-xs text-zinc-500">Rooms</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Activity className="h-4 w-4 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-400">{onlineCount}/{agents.length}</p>
          <p className="text-xs text-zinc-500">Agents Online</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <BarChart3 className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{(stats.tokensUsed / 1000).toFixed(0)}K</p>
          <p className="text-xs text-zinc-500">Tokens Used</p>
        </div>
      </div>

      {/* Agent Status */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">SDLC Agents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {agents.map((agent) => {
            const statusColor = agent.status === 'online' ? 'bg-green-500' : agent.status === 'busy' ? 'bg-yellow-400' : 'bg-zinc-600';
            return (
              <div key={agent.type} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `${agent.color}20` }}>
                  <agent.icon className="h-4 w-4" style={{ color: agent.color }} />
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 ${statusColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-50">{agent.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{agent.activity || 'offline'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-50">Recent Conversations</h2>
          <Link href="/portal/chat" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            Open Chat <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {recentConversations.map((conv) => (
            <Link key={conv.id} href="/portal/chat"
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">#</span>
                  <span className="text-sm font-medium text-zinc-50">{conv.room}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">{conv.lastMessage}</p>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <div className="flex -space-x-1">
                  {conv.agents.map((a) => {
                    const agent = agents.find((ag) => ag.type === a);
                    return agent ? (
                      <div key={a} className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-900"
                        style={{ background: `${agent.color}30` }}>
                        <agent.icon className="h-2.5 w-2.5" style={{ color: agent.color }} />
                      </div>
                    ) : null;
                  })}
                </div>
                <span className="text-[10px] text-zinc-600">{conv.time}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
