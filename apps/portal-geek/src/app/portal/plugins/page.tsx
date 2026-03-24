'use client';

import { useState } from 'react';
import { Puzzle, Search, Download, Star, Copy, Check, Tag } from 'lucide-react';

const categories = ['All', 'Productivity', 'AI', 'DevOps', 'Fun', 'Analytics'];

const plugins = [
  {
    name: 'unicore-plugin-git-stats',
    description: 'Advanced git statistics and contribution graphs in the terminal.',
    category: 'Analytics',
    downloads: 2340,
    stars: 48,
    version: '1.2.0',
    cmd: 'unicore plugins install git-stats',
  },
  {
    name: 'unicore-plugin-ai-review',
    description: 'AI-powered code review suggestions directly in your CLI workflow.',
    category: 'AI',
    downloads: 1870,
    stars: 62,
    version: '0.9.1',
    cmd: 'unicore plugins install ai-review',
  },
  {
    name: 'unicore-plugin-deploy-monitor',
    description: 'Real-time deployment monitoring with ASCII progress bars and alerts.',
    category: 'DevOps',
    downloads: 1520,
    stars: 35,
    version: '1.0.3',
    cmd: 'unicore plugins install deploy-monitor',
  },
  {
    name: 'unicore-plugin-pomodoro',
    description: 'Built-in pomodoro timer with XP bonuses for focused work sessions.',
    category: 'Productivity',
    downloads: 980,
    stars: 29,
    version: '1.1.0',
    cmd: 'unicore plugins install pomodoro',
  },
  {
    name: 'unicore-plugin-ascii-art',
    description: 'Generate ASCII art from text and images for terminal flair.',
    category: 'Fun',
    downloads: 760,
    stars: 41,
    version: '0.5.2',
    cmd: 'unicore plugins install ascii-art',
  },
  {
    name: 'unicore-plugin-docker-dash',
    description: 'Docker container management dashboard in your terminal.',
    category: 'DevOps',
    downloads: 1240,
    stars: 38,
    version: '1.3.0',
    cmd: 'unicore plugins install docker-dash',
  },
  {
    name: 'unicore-plugin-todoist',
    description: 'Sync tasks with Todoist and earn XP for completing them.',
    category: 'Productivity',
    downloads: 650,
    stars: 22,
    version: '0.8.0',
    cmd: 'unicore plugins install todoist',
  },
  {
    name: 'unicore-plugin-trivia',
    description: 'Programming trivia game — challenge friends and earn bonus XP.',
    category: 'Fun',
    downloads: 430,
    stars: 18,
    version: '0.3.1',
    cmd: 'unicore plugins install trivia',
  },
];

export default function PluginsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [copied, setCopied] = useState<string | null>(null);

  function copy(cmd: string, name: string) {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(name);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const filtered = plugins.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'All' || p.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Puzzle className="h-6 w-6 text-green-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Plugins</h1>
          <p className="text-sm text-zinc-400">Browse and install CLI plugins to extend your workflow.</p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plugins..."
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-10 pr-3 text-sm text-zinc-50 placeholder-zinc-600 focus:border-green-600 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-green-600 text-white'
                  : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Plugin grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {filtered.map((plugin) => (
          <div
            key={plugin.name}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-50">{plugin.name}</h3>
                <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">{plugin.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Tag className="h-3 w-3" /> {plugin.version}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Download className="h-3 w-3" /> {plugin.downloads.toLocaleString()}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <Star className="h-3 w-3" /> {plugin.stars}
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                {plugin.category}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-green-400 truncate">{plugin.cmd}</code>
              <button
                onClick={() => copy(plugin.cmd, plugin.name)}
                className="shrink-0 text-zinc-500 hover:text-zinc-50 transition-colors"
              >
                {copied === plugin.name ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 py-10 text-center">
          <Puzzle className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">No plugins match your search.</p>
        </div>
      )}
    </div>
  );
}
