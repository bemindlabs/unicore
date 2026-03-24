'use client';

import {
  BarChart3,
  MessageCircle,
  Zap,
  Clock,
  TrendingUp,
  Code2,
  TestTube,
  Server,
  ClipboardList,
  Layers,
} from 'lucide-react';

const usageStats = {
  totalTokens: 842_500,
  totalMessages: 1_247,
  totalConversations: 156,
  avgResponseTime: '1.2s',
  dailyTokens: [
    { day: 'Mon', tokens: 145_000 },
    { day: 'Tue', tokens: 128_000 },
    { day: 'Wed', tokens: 167_000 },
    { day: 'Thu', tokens: 112_000 },
    { day: 'Fri', tokens: 189_000 },
    { day: 'Sat', tokens: 52_000 },
    { day: 'Sun', tokens: 49_500 },
  ],
};

const agentUsage = [
  { type: 'developer', name: 'Developer', icon: Code2, color: '#22c55e', messages: 412, tokens: 285_000, pct: 34 },
  { type: 'architect', name: 'Architect', icon: Layers, color: '#6366f1', messages: 298, tokens: 210_000, pct: 25 },
  { type: 'tester', name: 'Tester', icon: TestTube, color: '#f59e0b', messages: 234, tokens: 168_000, pct: 20 },
  { type: 'pm', name: 'PM', icon: ClipboardList, color: '#ec4899', messages: 178, tokens: 112_000, pct: 13 },
  { type: 'devops', name: 'DevOps', icon: Server, color: '#3b82f6', messages: 125, tokens: 67_500, pct: 8 },
];

const costBreakdown = {
  inputTokens: 542_000,
  outputTokens: 300_500,
  inputCost: 2.71,
  outputCost: 4.51,
  totalCost: 7.22,
  model: 'claude-sonnet-4-20250514',
};

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-zinc-800">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const maxTokens = Math.max(...usageStats.dailyTokens.map((d) => d.tokens));

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-blue-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Analytics</h1>
          <p className="text-sm text-zinc-400">Token usage, conversations, and cost breakdown.</p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Zap className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{(usageStats.totalTokens / 1000).toFixed(0)}K</p>
          <p className="text-xs text-zinc-500">Total Tokens</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <MessageCircle className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{usageStats.totalMessages.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Messages</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <TrendingUp className="h-4 w-4 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{usageStats.totalConversations}</p>
          <p className="text-xs text-zinc-500">Conversations</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <Clock className="h-4 w-4 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-zinc-50">{usageStats.avgResponseTime}</p>
          <p className="text-xs text-zinc-500">Avg Response</p>
        </div>
      </div>

      {/* Daily usage chart (simplified bar chart) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">Daily Token Usage (This Week)</h2>
        <div className="flex items-end gap-2 h-40">
          {usageStats.dailyTokens.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-500">{(d.tokens / 1000).toFixed(0)}K</span>
              <div
                className="w-full rounded-t bg-blue-600 transition-all"
                style={{ height: `${(d.tokens / maxTokens) * 100}%` }}
              />
              <span className="text-[10px] text-zinc-500">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent usage */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">Usage by Agent</h2>
        <div className="space-y-3">
          {agentUsage.map((agent) => (
            <div key={agent.type} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${agent.color}20` }}>
                <agent.icon className="h-3.5 w-3.5" style={{ color: agent.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-zinc-50">{agent.name}</span>
                  <span className="text-xs text-zinc-500">{agent.messages} msgs &middot; {(agent.tokens / 1000).toFixed(0)}K tokens</span>
                </div>
                <ProgressBar value={agent.pct} color={agent.color} />
              </div>
              <span className="text-xs font-mono text-zinc-400 w-8 text-right">{agent.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-sm font-semibold text-zinc-50 mb-4">Cost Breakdown (This Month)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Input Tokens</p>
            <p className="text-sm font-medium text-zinc-50">{(costBreakdown.inputTokens / 1000).toFixed(0)}K</p>
            <p className="text-xs text-zinc-400">${costBreakdown.inputCost.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Output Tokens</p>
            <p className="text-sm font-medium text-zinc-50">{(costBreakdown.outputTokens / 1000).toFixed(0)}K</p>
            <p className="text-xs text-zinc-400">${costBreakdown.outputCost.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs text-zinc-500">Total Cost</p>
            <p className="text-sm font-bold text-blue-400">${costBreakdown.totalCost.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-500">{costBreakdown.model}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
