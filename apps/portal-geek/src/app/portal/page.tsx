'use client';

import { useState } from 'react';
import {
  Terminal,
  Trophy,
  Flame,
  Star,
  Lock,
  CheckCircle2,
  Gamepad2,
  Zap,
} from 'lucide-react';

// ── Mock data ─────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 1000;

const player = {
  username: 'dev_master',
  level: 7,
  xp: 6420,
  xpToNextLevel: 7000,
  title: 'Code Architect',
};

const achievements = [
  { id: 'first-commit', name: 'First Blood', description: 'Make your first commit', icon: '⚔️', earned: true, earnedAt: '2025-01-12', progress: 1, total: 1 },
  { id: '10-commits', name: 'Code Warrior', description: 'Reach 10 commits', icon: '🗡️', earned: true, earnedAt: '2025-01-15', progress: 10, total: 10 },
  { id: '100-commits', name: 'Commit Machine', description: 'Reach 100 commits', icon: '⚡', earned: true, earnedAt: '2025-02-03', progress: 100, total: 100 },
  { id: 'streak-7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', earned: true, earnedAt: '2025-01-20', progress: 7, total: 7 },
  { id: 'streak-30', name: 'Monthly Grind', description: 'Maintain a 30-day streak', icon: '🌙', earned: false, progress: 14, total: 30 },
  { id: '1000-xp', name: 'XP Hunter', description: 'Earn 1,000 XP', icon: '💎', earned: true, earnedAt: '2025-01-25', progress: 1000, total: 1000 },
  { id: '5000-xp', name: 'XP Legend', description: 'Earn 5,000 XP', icon: '👑', earned: true, earnedAt: '2025-03-01', progress: 5000, total: 5000 },
  { id: '10000-xp', name: 'XP Overlord', description: 'Earn 10,000 XP', icon: '🏆', earned: false, progress: 6420, total: 10000 },
  { id: 'multiplayer', name: 'Team Player', description: 'Join a multiplayer session', icon: '🤝', earned: true, earnedAt: '2025-02-10', progress: 1, total: 1 },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Complete 3 tasks in under 1 hour', icon: '🚀', earned: true, earnedAt: '2025-02-20', progress: 3, total: 3 },
];

const streaks = [
  { label: 'Coding', days: 14, best: 21, color: 'text-orange-400' },
  { label: 'Commits', days: 7, best: 14, color: 'text-blue-400' },
  { label: 'Login', days: 22, best: 30, color: 'text-green-400' },
];

const recentActivity = [
  { id: 1, event: 'Achievement Unlocked', detail: 'XP Legend — Earned 5,000 XP', xp: 250, time: '2h ago' },
  { id: 2, event: 'Commit Bonus', detail: 'feature/UNC-956 — 3 commits', xp: 90, time: '3h ago' },
  { id: 3, event: 'Multiplayer Session', detail: 'Pair programming with pixel_witch', xp: 150, time: '1d ago' },
  { id: 4, event: 'Task Completed', detail: 'Dashboard RAG integration', xp: 200, time: '1d ago' },
  { id: 5, event: 'Daily Login', detail: '22-day streak bonus', xp: 50, time: '2d ago' },
  { id: 6, event: 'Code Review', detail: 'Reviewed 2 PRs', xp: 80, time: '2d ago' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full rounded-full bg-zinc-800 ${className}`}>
      <div
        className="h-full rounded-full bg-green-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
  const levelXpStart = (player.level - 1) * XP_PER_LEVEL;
  const xpInLevel = player.xp - levelXpStart;
  const xpNeeded = player.xpToNextLevel - levelXpStart;
  const progress = Math.round((xpInLevel / xpNeeded) * 100);

  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Terminal className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-400">Welcome back, {player.username}</p>
        </div>
      </div>

      {/* XP Bar */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-600/20">
              <span className="text-lg font-bold text-green-500">{player.level}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-50">{player.username}</p>
              <p className="text-xs text-zinc-500">{player.title}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-zinc-50">{player.xp.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">total XP</p>
          </div>
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Level {player.level}</span>
          <span>{xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
          <span>Level {player.level + 1}</span>
        </div>
        <ProgressBar value={progress} className="h-3" />
        <p className="mt-2 text-center text-xs text-zinc-500">
          {(player.xpToNextLevel - player.xp).toLocaleString()} XP to next level
        </p>
      </div>

      {/* Streaks */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Flame className="h-4 w-4 text-orange-400" />
          Active Streaks
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {streaks.map((s) => (
            <div key={s.label} className="text-center space-y-1.5">
              <p className={`text-3xl font-bold ${s.color}`}>{s.days}</p>
              <p className="text-xs font-medium text-zinc-300">{s.label}</p>
              <p className="text-[11px] text-zinc-600">Best: {s.best} days</p>
              <ProgressBar value={Math.round((s.days / s.best) * 100)} />
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
            <Trophy className="h-4 w-4 text-yellow-400" />
            Achievements
          </h2>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {earned.length} / {achievements.length}
          </span>
        </div>

        {/* Earned */}
        <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Earned</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
          {earned.map((a) => (
            <div key={a.id} className="flex flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center" title={a.description}>
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-zinc-50 leading-tight">{a.name}</span>
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {a.earnedAt}
              </span>
            </div>
          ))}
        </div>

        {/* In Progress */}
        <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">In Progress</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {locked.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <span className="text-xl opacity-50">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-zinc-300">{a.name}</span>
                  <Lock className="h-3 w-3 text-zinc-600" />
                </div>
                <p className="text-[11px] text-zinc-500 truncate">{a.description}</p>
                <div className="mt-1.5 space-y-0.5">
                  <ProgressBar value={Math.round((a.progress / a.total) * 100)} className="h-1.5" />
                  <p className="text-[10px] text-zinc-600">{a.progress} / {a.total}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Gamepad2 className="h-4 w-4 text-purple-400" />
          Recent Activity
        </h2>
        <div className="divide-y divide-zinc-800">
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-50 truncate">{item.event}</p>
                <p className="text-xs text-zinc-500 truncate">{item.detail}</p>
              </div>
              <div className="flex flex-col items-end ml-4 shrink-0">
                <span className="text-xs font-mono font-medium text-green-400">+{item.xp} XP</span>
                <span className="text-[10px] text-zinc-600">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
