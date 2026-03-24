'use client';

import { Star, Medal } from 'lucide-react';

const leaderboard = [
  { rank: 1, username: 'x0_hax0r', xp: 12_840, level: 12, badge: '🥇' },
  { rank: 2, username: 'pixel_witch', xp: 10_110, level: 10, badge: '🥈' },
  { rank: 3, username: 'rustacean99', xp: 9_340, level: 9, badge: '🥉' },
  { rank: 4, username: 'node_ninja', xp: 8_200, level: 8, badge: null },
  { rank: 5, username: 'ts_wizard', xp: 7_650, level: 8, badge: null },
  { rank: 6, username: 'async_alice', xp: 7_100, level: 7, badge: null },
  { rank: 7, username: 'dev_master', xp: 6_420, level: 7, badge: '⭐', isCurrentUser: true },
  { rank: 8, username: 'vim_lord', xp: 5_890, level: 6, badge: null },
  { rank: 9, username: 'docker_dan', xp: 5_300, level: 5, badge: null },
  { rank: 10, username: 'git_guru', xp: 4_750, level: 5, badge: null },
  { rank: 11, username: 'cli_champion', xp: 4_200, level: 4, badge: null },
  { rank: 12, username: 'bash_boss', xp: 3_800, level: 4, badge: null },
  { rank: 13, username: 'code_monk', xp: 3_500, level: 4, badge: null },
  { rank: 14, username: 'type_queen', xp: 3_200, level: 3, badge: null },
  { rank: 15, username: 'hack_star', xp: 2_900, level: 3, badge: null },
];

export default function LeaderboardPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-6 w-6 text-yellow-400" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Leaderboard</h1>
          <p className="text-sm text-zinc-400">Top contributors this month</p>
        </div>
      </div>

      {/* Top 3 podium */}
      <div className="grid grid-cols-3 gap-3">
        {leaderboard.slice(0, 3).map((entry) => (
          <div
            key={entry.rank}
            className={`flex flex-col items-center rounded-lg border p-5 text-center ${
              entry.rank === 1
                ? 'border-yellow-600/50 bg-yellow-950/20'
                : entry.rank === 2
                ? 'border-zinc-500/30 bg-zinc-800/30'
                : 'border-orange-800/30 bg-orange-950/10'
            }`}
          >
            <span className="text-3xl mb-2">{entry.badge}</span>
            <p className="text-sm font-semibold text-zinc-50">{entry.username}</p>
            <p className="text-lg font-bold font-mono text-green-400 mt-1">{entry.xp.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Level {entry.level}</p>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-16">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Player</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">XP</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {leaderboard.map((entry) => (
              <tr
                key={entry.rank}
                className={`transition-colors hover:bg-zinc-800/50 ${
                  entry.isCurrentUser ? 'bg-green-950/20' : ''
                }`}
              >
                <td className="px-4 py-3">
                  {entry.badge ? (
                    <span className="text-base">{entry.badge}</span>
                  ) : (
                    <span className="text-sm text-zinc-500">{entry.rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${entry.isCurrentUser ? 'text-green-400' : 'text-zinc-50'}`}>
                    {entry.username}
                  </span>
                  {entry.isCurrentUser && (
                    <span className="ml-2 rounded border border-green-800 bg-green-950/50 px-1.5 py-0.5 text-[10px] text-green-400">
                      you
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-zinc-300">
                  {entry.xp.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    Lv {entry.level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
