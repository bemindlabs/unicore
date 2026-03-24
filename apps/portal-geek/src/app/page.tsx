'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Terminal,
  Trophy,
  Flame,
  Users,
  Gamepad2,
  Zap,
  Keyboard,
  BarChart3,
  Puzzle,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const features = [
  { icon: Terminal, title: 'Terminal Mode', description: 'Full platform control via CLI and TUI — zero web UI dependency.' },
  { icon: Gamepad2, title: 'Game Mode', description: 'Gamified workflows with XP, achievements, leaderboards, and quests.' },
  { icon: Trophy, title: 'Achievements', description: 'Unlock badges by committing, reviewing, deploying, and collaborating.' },
  { icon: Flame, title: 'Streaks', description: 'Track daily coding, commit, and login streaks to earn bonus XP.' },
  { icon: Users, title: 'Multiplayer', description: 'Collaborative terminal sessions with real-time sync and shared XP.' },
  { icon: Keyboard, title: 'Keyboard-Driven', description: 'Vim-style keybindings and a command palette for blazing-fast navigation.' },
  { icon: BarChart3, title: 'ASCII Dashboards', description: 'Real-time metrics and monitoring rendered as terminal graphics.' },
  { icon: Puzzle, title: 'Plugin System', description: 'Extensible CLI plugins — build, share, and install custom commands.' },
];

const installOptions = [
  { label: 'npm', cmd: 'npm install -g @bemindlabs/unicore-cli' },
  { label: 'pnpm', cmd: 'pnpm add -g @bemindlabs/unicore-cli' },
  { label: 'yarn', cmd: 'yarn global add @bemindlabs/unicore-cli' },
  { label: 'brew', cmd: 'brew install unicore/tap/unicore-cli' },
];

const quickStart = `$ unicore login
Authenticated as dev_master

$ unicore xp
Level 7 — 6,420 / 7,000 XP
580 XP to next level

$ unicore streak
Coding:  14 days (best: 21)
Commits: 7 days  (best: 14)
Login:   22 days (best: 30)

$ unicore session start "Bug Hunt"
Session started — share code: GK-7X2M`;

function InstallSection() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(cmd: string, label: string) {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <section id="download" className="py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 text-center">
          <Zap className="mx-auto mb-4 h-8 w-8 text-green-500" />
          <h2 className="text-3xl font-bold text-zinc-50">Install in seconds</h2>
          <p className="mt-2 text-zinc-400">Pick your package manager and start leveling up.</p>
        </div>

        <div className="mx-auto max-w-2xl space-y-3">
          {installOptions.map((opt) => (
            <div
              key={opt.label}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-xs text-green-400">
                {opt.label}
              </span>
              <code className="flex-1 font-mono text-sm text-zinc-300 truncate">{opt.cmd}</code>
              <button
                onClick={() => copy(opt.cmd, opt.label)}
                className="shrink-0 text-zinc-500 hover:text-zinc-50 transition-colors"
                title="Copy"
              >
                {copied === opt.label ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Quick start</p>
          <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">{quickStart}</pre>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-900/20 via-zinc-950 to-zinc-950" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-800 bg-green-950/50 px-4 py-1.5">
            <Terminal className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-green-400">Terminal-first. Game-mode built in.</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
            Level up your dev workflow.{' '}
            <span className="text-green-500">In the terminal.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            UniCore Geek replaces the dashboard with a pure terminal experience. Earn XP, unlock achievements,
            climb leaderboards, and collaborate in multiplayer coding sessions.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
            >
              Get Started
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="#download"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
            >
              <Terminal className="h-4 w-4" />
              Install CLI
            </Link>
          </div>

          {/* Terminal preview */}
          <div className="mx-auto mt-12 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 text-left shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-zinc-500">unicore-geek</span>
            </div>
            <pre className="p-4 font-mono text-sm leading-relaxed">
              <span className="text-green-400">$</span>{' '}
              <span className="text-zinc-50">unicore game status</span>
              {'\n\n'}
              <span className="text-zinc-500">{'  '}Player:</span>{' '}
              <span className="text-zinc-50">dev_master</span>
              {'\n'}
              <span className="text-zinc-500">{'  '}Level:</span>{' '}
              <span className="text-green-400">7</span>{' '}
              <span className="text-zinc-600">|</span>{' '}
              <span className="text-zinc-500">XP:</span>{' '}
              <span className="text-green-400">6,420 / 7,000</span>
              {'\n'}
              <span className="text-zinc-500">{'  '}Title:</span>{' '}
              <span className="text-yellow-400">Code Architect</span>
              {'\n'}
              <span className="text-zinc-500">{'  '}Streak:</span>{' '}
              <span className="text-orange-400">14 days</span>
              {'\n\n'}
              <span className="text-zinc-500">{'  '}Recent:</span>
              {'\n'}
              <span className="text-zinc-600">{'    '}+250 XP</span>{' '}
              <span className="text-zinc-400">Achievement: XP Legend</span>
              {'\n'}
              <span className="text-zinc-600">{'    '}+90 XP</span>{' '}
              <span className="text-zinc-400">{'  '}3 commits on feature/UNC-956</span>
              {'\n'}
              <span className="text-zinc-600">{'    '}+150 XP</span>{' '}
              <span className="text-zinc-400">Multiplayer: pixel_witch</span>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-50">Everything in the terminal</h2>
            <p className="mt-2 text-zinc-400">No GUI, no fluff — just raw power at your fingertips.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-green-800/50"
              >
                <feat.icon className="mb-3 h-5 w-5 text-green-500" />
                <h3 className="text-sm font-semibold text-zinc-50">{feat.title}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <InstallSection />

      {/* CTA */}
      <section className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold text-zinc-50">Ready to level up?</h2>
          <p className="mt-2 text-zinc-400">Activate the Geek CLI add-on and start earning XP today.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
