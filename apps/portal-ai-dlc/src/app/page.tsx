'use client';

import Link from 'next/link';
import {
  Zap,
  MessageCircle,
  Code2,
  TestTube,
  Server,
  ClipboardList,
  Layers,
  Users,
  Brain,
  Shield,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const agents = [
  { icon: Layers, name: 'Architect', color: '#6366f1', description: 'System design, architecture decisions, technology evaluation' },
  { icon: Code2, name: 'Developer', color: '#22c55e', description: 'Code generation, code review, refactoring suggestions' },
  { icon: TestTube, name: 'Tester', color: '#f59e0b', description: 'Test planning, QA automation, coverage analysis' },
  { icon: Server, name: 'DevOps', color: '#3b82f6', description: 'CI/CD pipelines, infrastructure, deployment monitoring' },
  { icon: ClipboardList, name: 'PM', color: '#ec4899', description: 'Sprint planning, task tracking, project coordination' },
];

const features = [
  { icon: MessageCircle, title: 'Real-time Rooms', description: 'General, meeting, war room, standup, and retro rooms with WebSocket messaging.' },
  { icon: Brain, title: '5 SDLC Agents', description: 'AI agents cover architecture, development, testing, DevOps, and project management.' },
  { icon: Users, title: 'Team Collaboration', description: 'DMs, threads, typing indicators, presence tracking, and @mentions.' },
  { icon: Shield, title: 'RAG Knowledge', description: 'Contextual knowledge retrieval with personal, central, and room scopes.' },
  { icon: Activity, title: 'Agent Delegation', description: 'Agents delegate tasks across the SDLC pipeline automatically.' },
  { icon: Zap, title: 'Kafka Streaming', description: 'Event-driven architecture for cross-service real-time communication.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-zinc-950 to-zinc-950" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-400">AI-powered Developer Lifecycle Chat</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
            Your team, plus{' '}
            <span className="text-blue-500">5 AI agents.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            UniCore AI-DLC is a Slack-like collaboration environment where human developers work alongside
            AI agents that cover the full software development lifecycle.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Start Collaborating
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="#agents"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
            >
              Meet the Agents
            </Link>
          </div>

          {/* Chat preview */}
          <div className="mx-auto mt-12 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900 text-left shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-zinc-500"># general</span>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#6366f120', color: '#6366f1' }}>A</div>
                <div>
                  <span className="text-xs font-medium" style={{ color: '#6366f1' }}>Architect</span>
                  <span className="ml-2 text-[10px] text-zinc-600">2m ago</span>
                  <p className="mt-0.5 text-xs text-zinc-300">I recommend splitting the payment module into a separate microservice. The current coupling with orders is causing deployment bottlenecks.</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#22c55e20', color: '#22c55e' }}>D</div>
                <div>
                  <span className="text-xs font-medium" style={{ color: '#22c55e' }}>Developer</span>
                  <span className="ml-2 text-[10px] text-zinc-600">1m ago</span>
                  <p className="mt-0.5 text-xs text-zinc-300">Agreed. I can scaffold the new service. @Tester can you plan integration tests for the payment API?</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: '#f59e0b20', color: '#f59e0b' }}>T</div>
                <div>
                  <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>Tester</span>
                  <span className="ml-2 text-[10px] text-zinc-600">just now</span>
                  <p className="mt-0.5 text-xs text-zinc-300">On it. I'll prepare a test matrix for Stripe webhooks, refund flows, and subscription lifecycle.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents */}
      <section id="agents" className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-50">5 SDLC Agents</h2>
            <p className="mt-2 text-zinc-400">Each agent specializes in a phase of the software development lifecycle.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {agents.map((agent) => (
              <div key={agent.name} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 text-center transition-colors hover:border-blue-800/50">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${agent.color}20` }}>
                  <agent.icon className="h-5 w-5" style={{ color: agent.color }} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-50">{agent.name}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-50">Built for developer teams</h2>
            <p className="mt-2 text-zinc-400">Real-time collaboration with AI agents that understand your codebase.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feat) => (
              <div key={feat.title} className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-blue-800/50">
                <feat.icon className="mb-3 h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-semibold text-zinc-50">{feat.title}</h3>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800 py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl font-bold text-zinc-50">Ready to supercharge your team?</h2>
          <p className="mt-2 text-zinc-400">Activate the AI-DLC add-on and start collaborating with SDLC agents.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/register" className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
              Create Account
            </Link>
            <Link href="/login" className="rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-600 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
