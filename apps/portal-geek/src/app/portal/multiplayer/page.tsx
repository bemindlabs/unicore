'use client';

import {
  Users,
  Wifi,
  WifiOff,
  Clock,
  Plus,
  Gamepad2,
} from 'lucide-react';

const sessions = [
  {
    id: 'sess-1',
    name: 'Feature Sprint #12',
    participants: ['pixel_witch', 'dev_master'],
    status: 'active' as const,
    started: '45m ago',
    xp: 120,
    code: 'GK-7X2M',
  },
  {
    id: 'sess-2',
    name: 'Bug Hunt Royale',
    participants: ['rustacean99', 'node_ninja', 'ts_wizard'],
    status: 'active' as const,
    started: '2h ago',
    xp: 80,
    code: 'GK-4P9R',
  },
  {
    id: 'sess-3',
    name: 'Refactor Party',
    participants: ['async_alice', 'dev_master', 'vim_lord'],
    status: 'ended' as const,
    started: '1d ago',
    xp: 200,
    code: 'GK-L8QN',
  },
  {
    id: 'sess-4',
    name: 'Deploy Day',
    participants: ['docker_dan', 'git_guru'],
    status: 'ended' as const,
    started: '2d ago',
    xp: 150,
    code: 'GK-W2TF',
  },
  {
    id: 'sess-5',
    name: 'Pair Review Session',
    participants: ['dev_master', 'type_queen'],
    status: 'ended' as const,
    started: '3d ago',
    xp: 180,
    code: 'GK-M5KJ',
  },
];

const stats = {
  totalSessions: 12,
  totalXp: 1_820,
  uniquePartners: 8,
  avgSessionLength: '47m',
};

export default function MultiplayerPage() {
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const pastSessions = sessions.filter((s) => s.status === 'ended');

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-green-500" />
          <div>
            <h1 className="text-xl font-bold text-zinc-50">Multiplayer</h1>
            <p className="text-sm text-zinc-400">Collaborative terminal sessions with real-time sync.</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          New Session
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="text-2xl font-bold text-zinc-50">{stats.totalSessions}</p>
          <p className="text-xs text-zinc-500">Total Sessions</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.totalXp.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">XP Earned</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="text-2xl font-bold text-zinc-50">{stats.uniquePartners}</p>
          <p className="text-xs text-zinc-500">Partners</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-center">
          <p className="text-2xl font-bold text-zinc-50">{stats.avgSessionLength}</p>
          <p className="text-xs text-zinc-500">Avg Length</p>
        </div>
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
            <Wifi className="h-4 w-4 text-green-500" />
            Active Sessions
          </h2>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border border-green-800/30 bg-green-950/10 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-50 truncate">{session.name}</p>
                    <p className="text-xs text-zinc-500">
                      {session.participants.join(', ')} &middot; {session.started}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <code className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-green-400">{session.code}</code>
                  <span className="text-xs font-mono text-green-400">+{session.xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past sessions */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Clock className="h-4 w-4 text-zinc-400" />
          Past Sessions
        </h2>
        <div className="space-y-2">
          {pastSessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <WifiOff className="h-4 w-4 text-zinc-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-50 truncate">{session.name}</p>
                  <p className="text-xs text-zinc-500">
                    {session.participants.join(', ')} &middot; {session.started}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-xs font-mono text-zinc-400">+{session.xp} XP</span>
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">ended</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CLI hint */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-medium text-zinc-300">Start from your terminal</span>
        </div>
        <pre className="font-mono text-xs text-green-400 leading-relaxed">{`$ unicore session start "My Session"
$ unicore session join GK-7X2M
$ unicore session list`}</pre>
      </div>
    </div>
  );
}
