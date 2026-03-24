'use client';

import { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Monitor,
  Apple,
  Terminal,
  Package,
  Tag,
  FileText,
} from 'lucide-react';

const installOptions = [
  { label: 'npm', cmd: 'npm install -g @bemindlabs/unicore-cli', recommended: true },
  { label: 'pnpm', cmd: 'pnpm add -g @bemindlabs/unicore-cli', recommended: false },
  { label: 'yarn', cmd: 'yarn global add @bemindlabs/unicore-cli', recommended: false },
  { label: 'brew', cmd: 'brew install unicore/tap/unicore-cli', recommended: false },
];

const releases = [
  {
    version: 'v0.1.0',
    date: '2026-03-20',
    tag: 'latest',
    changes: [
      'Initial release of Geek CLI',
      'XP, achievements, and streaks system',
      'Multiplayer terminal sessions',
      'ASCII dashboard for metrics',
      'Plugin system with registry',
      'Vim-style keybindings',
    ],
  },
];

const systemRequirements = [
  { label: 'Node.js', value: '20.0.0 or later' },
  { label: 'OS', value: 'macOS, Linux, Windows (WSL2 recommended)' },
  { label: 'Terminal', value: 'iTerm2, Alacritty, Kitty, Windows Terminal, or any true-color terminal' },
  { label: 'Network', value: 'Required for multiplayer, leaderboards, and plugin registry' },
  { label: 'License', value: 'Pro plan or Geek CLI add-on' },
];

export default function DownloadsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(cmd: string, label: string) {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Download className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Downloads</h1>
          <p className="text-sm text-zinc-400">Install the Geek CLI and start leveling up.</p>
        </div>
      </div>

      {/* Install commands */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Package className="h-4 w-4 text-green-500" />
          Install via package manager
        </h2>
        <div className="space-y-2">
          {installOptions.map((opt) => (
            <div
              key={opt.label}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3"
            >
              <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-xs text-green-400 shrink-0">
                {opt.label}
              </span>
              {opt.recommended && (
                <span className="rounded bg-green-950/50 border border-green-800 px-1.5 py-0.5 text-[10px] text-green-400 shrink-0">
                  recommended
                </span>
              )}
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
      </div>

      {/* Quick start */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Terminal className="h-4 w-4 text-green-500" />
          Quick start
        </h2>
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
          <pre className="font-mono text-sm text-green-400 leading-relaxed whitespace-pre-wrap">{`$ unicore login
Authenticated as dev_master

$ unicore xp
Level 7 — 6,420 / 7,000 XP

$ unicore streak
Coding:  14 days (best: 21)
Commits: 7 days  (best: 14)

$ unicore session start "Feature Sprint"
Session started — share code: GK-7X2M

$ unicore plugins list
12 plugins available — run 'unicore plugins install <name>'

$ unicore --help
See all commands`}</pre>
        </div>
      </div>

      {/* System requirements */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <Monitor className="h-4 w-4 text-zinc-400" />
          System Requirements
        </h2>
        <div className="divide-y divide-zinc-800">
          {systemRequirements.map((req) => (
            <div key={req.label} className="flex items-start gap-4 py-2.5 first:pt-0 last:pb-0">
              <span className="text-xs font-medium text-zinc-500 w-20 shrink-0">{req.label}</span>
              <span className="text-sm text-zinc-300">{req.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Release notes */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-50 mb-4">
          <FileText className="h-4 w-4 text-zinc-400" />
          Release Notes
        </h2>
        {releases.map((release) => (
          <div key={release.version}>
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-semibold text-zinc-50">{release.version}</span>
              <span className="rounded bg-green-950/50 border border-green-800 px-1.5 py-0.5 text-[10px] text-green-400">
                {release.tag}
              </span>
              <span className="text-xs text-zinc-500">{release.date}</span>
            </div>
            <ul className="space-y-1.5 pl-6">
              {release.changes.map((change, i) => (
                <li key={i} className="text-sm text-zinc-400 list-disc">{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
