'use client';

import { useState } from 'react';
import {
  Terminal,
  Trophy,
  Flame,
  Users,
  Download,
  Star,
  Lock,
  CheckCircle2,
  Circle,
  Gamepad2,
  Wifi,
  WifiOff,
  Copy,
  Check,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@unicore/ui';
import { ProGate } from '@/components/license/pro-gate';

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
  { id: 'multiplayer-5', name: 'Squad Goals', description: 'Complete 5 multiplayer sessions', icon: '👥', earned: false, progress: 3, total: 5 },
  { id: 'night-owl', name: 'Night Owl', description: 'Commit after midnight 10 times', icon: '🦉', earned: false, progress: 4, total: 10 },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Complete 3 tasks in under 1 hour', icon: '🚀', earned: true, earnedAt: '2025-02-20', progress: 3, total: 3 },
];

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
];

const streaks = [
  { label: 'Coding Streak', days: 14, best: 21, icon: '🔥', color: 'text-orange-500' },
  { label: 'Commit Streak', days: 7, best: 14, icon: '📝', color: 'text-blue-500' },
  { label: 'Login Streak', days: 22, best: 30, icon: '✅', color: 'text-green-500' },
];

const recentActivity = [
  { id: 1, event: 'Achievement Unlocked', detail: 'XP Legend — Earned 5,000 XP', xp: +250, time: '2h ago' },
  { id: 2, event: 'Commit Bonus', detail: 'feature/UNC-956 — 3 commits', xp: +90, time: '3h ago' },
  { id: 3, event: 'Multiplayer Session', detail: 'Pair programming with pixel_witch', xp: +150, time: '1d ago' },
  { id: 4, event: 'Task Completed', detail: 'Dashboard RAG integration', xp: +200, time: '1d ago' },
  { id: 5, event: 'Daily Login', detail: '22-day streak bonus', xp: +50, time: '2d ago' },
  { id: 6, event: 'Code Review', detail: 'Reviewed 2 PRs', xp: +80, time: '2d ago' },
];

const multiplayerSessions = [
  { id: 'sess-1', name: 'Feature Sprint #12', participants: ['pixel_witch', 'dev_master'], status: 'active', started: '45m ago', xp: 120 },
  { id: 'sess-2', name: 'Bug Hunt Royale', participants: ['rustacean99', 'node_ninja', 'ts_wizard'], status: 'active', started: '2h ago', xp: 80 },
  { id: 'sess-3', name: 'Refactor Party', participants: ['async_alice', 'dev_master', 'vim_lord'], status: 'ended', started: '1d ago', xp: 200 },
  { id: 'sess-4', name: 'Deploy Day', participants: ['docker_dan', 'git_guru'], status: 'ended', started: '2d ago', xp: 150 },
];

const installOptions = [
  { label: 'npm', cmd: 'npm install -g @unicore/cli' },
  { label: 'pnpm', cmd: 'pnpm add -g @unicore/cli' },
  { label: 'yarn', cmd: 'yarn global add @unicore/cli' },
  { label: 'brew', cmd: 'brew install unicore/tap/unicore-cli' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function xpProgress(current: number, levelStart: number, levelEnd: number) {
  return Math.round(((current - levelStart) / (levelEnd - levelStart)) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────

function XPBar() {
  const levelXpStart = (player.level - 1) * XP_PER_LEVEL;
  const progress = xpProgress(player.xp, levelXpStart, player.xpToNextLevel);
  const xpInLevel = player.xp - levelXpStart;
  const xpNeeded = player.xpToNextLevel - levelXpStart;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">{player.level}</span>
            </div>
            <div>
              <CardTitle className="text-base">{player.username}</CardTitle>
              <p className="text-xs text-muted-foreground">{player.title}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{player.xp.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">total XP</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Level {player.level}</span>
          <span>{xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
          <span>Level {player.level + 1}</span>
        </div>
        <Progress value={progress} className="h-3" />
        <p className="text-xs text-center text-muted-foreground">
          {(player.xpToNextLevel - player.xp).toLocaleString()} XP to next level
        </p>
      </CardContent>
    </Card>
  );
}

function AchievementsGrid() {
  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Achievements
          </CardTitle>
          <Badge variant="secondary">{earned.length} / {achievements.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Earned */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Earned</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {earned.map((a) => (
              <div
                key={a.id}
                className="flex flex-col items-center gap-1 rounded-lg border bg-card p-3 text-center"
                title={a.description}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-medium leading-tight">{a.name}</span>
                <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {a.earnedAt}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Locked */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">In Progress</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {locked.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="text-xl opacity-50">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium">{a.name}</span>
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{a.description}</p>
                  <div className="mt-1.5 space-y-0.5">
                    <Progress value={Math.round((a.progress / a.total) * 100)} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{a.progress} / {a.total}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-yellow-500" />
          Leaderboard
        </CardTitle>
        <CardDescription>Top contributors this month</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 pl-6">Rank</TableHead>
              <TableHead>Username</TableHead>
              <TableHead className="text-right">XP</TableHead>
              <TableHead className="text-right pr-6">Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((entry) => (
              <TableRow
                key={entry.rank}
                className={entry.isCurrentUser ? 'bg-primary/5 font-medium' : undefined}
              >
                <TableCell className="pl-6">
                  <div className="flex items-center gap-1.5">
                    {entry.badge ? (
                      <span className="text-base">{entry.badge}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground w-5 text-center">{entry.rank}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className={entry.isCurrentUser ? 'text-primary' : ''}>{entry.username}</span>
                  {entry.isCurrentUser && (
                    <Badge variant="outline" className="ml-2 text-[10px] h-4">you</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">{entry.xp.toLocaleString()}</TableCell>
                <TableCell className="text-right pr-6">
                  <Badge variant="secondary">Lv {entry.level}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Streaks() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-orange-500" />
          Active Streaks
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {streaks.map((s) => (
          <div key={s.label} className="text-center space-y-1.5">
            <span className="text-3xl">{s.icon}</span>
            <p className={`text-3xl font-bold ${s.color}`}>{s.days}</p>
            <p className="text-xs font-medium">{s.label}</p>
            <p className="text-[11px] text-muted-foreground">Best: {s.best} days</p>
            <Progress value={Math.round((s.days / s.best) * 100)} className="h-1.5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gamepad2 className="h-4 w-4 text-purple-500" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {recentActivity.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.event}</p>
              <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
            </div>
            <div className="flex flex-col items-end ml-4 shrink-0">
              <span className="text-xs font-mono font-medium text-green-600 dark:text-green-400">
                +{item.xp} XP
              </span>
              <span className="text-[10px] text-muted-foreground">{item.time}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MultiplayerSessions() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-blue-500" />
            Multiplayer Sessions
          </CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs">
            New Session
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {multiplayerSessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {session.status === 'active' ? (
                <Wifi className="h-4 w-4 text-green-500 shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{session.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.participants.join(', ')} · {session.started}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <span className="text-xs font-mono text-green-600 dark:text-green-400">+{session.xp} XP</span>
              <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                {session.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CLIDownload() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(cmd: string, label: string) {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" />
          Install CLI
        </CardTitle>
        <CardDescription>
          Run UniCore from your terminal — full XP, streaks, and multiplayer support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {installOptions.map((opt) => (
            <div key={opt.label} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <Badge variant="outline" className="font-mono text-[10px] shrink-0">{opt.label}</Badge>
              <code className="flex-1 text-xs font-mono truncate text-muted-foreground">{opt.cmd}</code>
              <button
                onClick={() => copy(opt.cmd, opt.label)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy to clipboard"
              >
                {copied === opt.label ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
          <p className="text-xs font-medium">Quick start</p>
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{`unicore login          # authenticate with your account
unicore xp             # view your XP and level
unicore streak         # check active streaks
unicore session start  # start a multiplayer session
unicore --help         # see all commands`}</pre>
        </div>
        <p className="text-xs text-muted-foreground">
          Requires Node.js 20+. Visit the{' '}
          <a
            href="https://github.com/bemindlabs/unicore-geek"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            unicore-geek
          </a>{' '}
          repository for source and documentation.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function GeekPage() {
  return (
    <ProGate
      feature="featGeekCli"
      featureName="Geek CLI"
      targetTier="Pro"
      description="Unlock XP progression, achievements, leaderboards, streaks, and multiplayer coding sessions."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Terminal className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Geek CLI</h1>
            <p className="text-muted-foreground">Level up your development workflow with XP, achievements, and multiplayer sessions.</p>
          </div>
        </div>

        {/* XP Progress */}
        <XPBar />

        {/* Streaks */}
        <Streaks />

        {/* Achievements */}
        <AchievementsGrid />

        {/* Two-column: Leaderboard + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LeaderboardTable />
          <ActivityFeed />
        </div>

        {/* Multiplayer Sessions */}
        <MultiplayerSessions />

        {/* CLI Download */}
        <CLIDownload />
      </div>
    </ProGate>
  );
}
