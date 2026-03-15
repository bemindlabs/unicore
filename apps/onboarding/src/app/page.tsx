import Link from 'next/link';
import {
  Button,
  Badge,
  Card,
  CardContent,
  Separator,
} from '@unicore/ui';

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI-First Engine',
    description:
      'Native LLM integration with 8 specialist AI agents — automate emails, finances, growth, operations, and more.',
  },
  {
    icon: '🏢',
    title: 'Built-in ERP',
    description:
      'CRM, orders, inventory, invoicing, expenses, and reports — all included, no external ERP needed.',
  },
  {
    icon: '📊',
    title: 'Unified Dashboard',
    description:
      'One screen for marketing, sales, and ops metrics. Customizable widgets tailored to your business type.',
  },
  {
    icon: '⚡',
    title: 'Automated Workflows',
    description:
      'Event-driven automation — low stock alerts, invoice follow-ups, customer replies — all handled automatically.',
  },
  {
    icon: '🗄️',
    title: 'Contextual Memory',
    description:
      'RAG-powered knowledge base so your AI remembers past decisions, client preferences, and project history.',
  },
  {
    icon: '🌐',
    title: 'Business Templates',
    description:
      'Pre-configured setups for E-Commerce, SaaS, Freelance, Retail, Content Creator, and more — launch in minutes.',
  },
];

const AGENTS = [
  { name: 'Router', role: 'Intent classification & task delegation', icon: '🔀' },
  { name: 'Comms', role: 'Email, social media, outreach', icon: '📧' },
  { name: 'Finance', role: 'Transactions, forecasting, invoices', icon: '💰' },
  { name: 'Growth', role: 'Funnels, ads, A/B testing', icon: '📈' },
  { name: 'Ops', role: 'Tasks, schedules, project management', icon: '🗂️' },
  { name: 'Research', role: 'Market intel, competitor monitoring', icon: '🔍' },
  { name: 'ERP', role: 'Natural language ERP queries', icon: '🏢' },
  { name: 'Builder', role: 'Code generation, deployments', icon: '🛠️' },
];

const EDITIONS = [
  { feature: 'Bootstrap Wizard & Templates', community: true, pro: true },
  { feature: 'Dashboard & Unified UI', community: true, pro: true },
  { feature: 'Internal ERP (all modules)', community: true, pro: true },
  { feature: 'AI Agents (Router + 2 specialists)', community: true, pro: true },
  { feature: 'AI Agents (all 7 specialists)', community: false, pro: true },
  { feature: 'Team Roles (up to 5)', community: false, pro: true },
  { feature: 'Advanced Workflows', community: false, pro: true },
  { feature: '21+ Communication Channels', community: false, pro: true },
  { feature: 'Custom Agent Builder', community: false, pro: true },
  { feature: 'White-label & SSO', community: false, pro: true },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-white to-secondary/5 pb-16 pt-12 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-sm">
            Open-Source &middot; AI-First &middot; Built for Small Teams
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            UniCore
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            The AI-driven operating system for solopreneurs and micro-teams.
            Replace dozens of SaaS tools with a single platform — automate
            workflows, manage operations, and deploy AI agents so your small
            team operates like a full company.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/wizard">
              <Button size="lg" className="w-full sm:w-auto text-base px-8">
                Get Started
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8">
                Learn More
              </Button>
            </a>
          </div>

          {/* Vision quote */}
          <div className="mx-auto mt-12 max-w-xl rounded-lg border bg-white/80 px-6 py-4 shadow-sm">
            <p className="text-sm italic text-muted-foreground">
              &ldquo;Enable 1-5 person teams to run with the efficiency and
              intelligence of a 50-person operation — AI agents handle the
              busywork, humans focus on decisions that matter.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mt-2 text-muted-foreground">
              A complete business operating system — AI, ERP, dashboards, and
              automation in one platform.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="transition-shadow hover:shadow-md">
                <CardContent className="pt-6">
                  <div className="mb-3 text-3xl">{f.icon}</div>
                  <h3 className="font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* AI Agents */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Your AI team, ready to work
            </h2>
            <p className="mt-2 text-muted-foreground">
              8 specialist agents powered by OpenClaw — each with its own role,
              tools, and memory. You choose which ones to activate.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((a) => (
              <div
                key={a.name}
                className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-sm"
              >
                <span className="text-2xl leading-none">{a.icon}</span>
                <div>
                  <p className="font-medium text-gray-900">{a.name} Agent</p>
                  <p className="text-xs text-muted-foreground">{a.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* How it works */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Up and running in 6 steps
            </h2>
            <p className="mt-2 text-muted-foreground">
              The Bootstrap Wizard configures everything to match your business
              — no code required.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { step: 1, title: 'Business Profile', desc: 'Choose your business type, name, currency, and timezone.' },
              { step: 2, title: 'Team & Roles', desc: 'Define who\'s on the team and what they can access.' },
              { step: 3, title: 'AI Agents', desc: 'Select which AI agents to activate and configure autonomy levels.' },
              { step: 4, title: 'ERP Modules', desc: 'Enable the CRM, orders, inventory, and invoicing modules you need.' },
              { step: 5, title: 'Integrations', desc: 'Connect Stripe, Plaid, LINE, Slack, and 20+ other services.' },
              { step: 6, title: 'Review & Launch', desc: 'Confirm your setup and provision your entire workspace.' },
            ].map((s) => (
              <div
                key={s.step}
                className="flex gap-4 rounded-lg border bg-white p-5 shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.step}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{s.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* Editions */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Community vs Pro
            </h2>
            <p className="mt-2 text-muted-foreground">
              Community Edition is free forever. Pro unlocks the full power.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-lg border bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_80px_80px] items-center gap-0 border-b bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
              <span>Feature</span>
              <span className="text-center">Free</span>
              <span className="text-center">Pro</span>
            </div>
            {EDITIONS.map((e, i) => (
              <div
                key={e.feature}
                className={`grid grid-cols-[1fr_80px_80px] items-center gap-0 px-4 py-2.5 text-sm ${
                  i < EDITIONS.length - 1 ? 'border-b' : ''
                }`}
              >
                <span className="text-gray-700">{e.feature}</span>
                <span className="text-center">
                  {e.community ? (
                    <span className="text-green-600">&#10003;</span>
                  ) : (
                    <span className="text-gray-300">&mdash;</span>
                  )}
                </span>
                <span className="text-center">
                  <span className="text-green-600">&#10003;</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* Tech Stack */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Built on modern foundations
            </h2>
          </div>

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-3">
            {[
              'Next.js 14',
              'NestJS',
              'TypeScript 5.5+',
              'PostgreSQL 16',
              'Redis 7',
              'Apache Kafka',
              'Qdrant',
              'OpenClaw',
              'Prisma ORM',
              'Tailwind CSS',
              'shadcn/ui',
              'Docker',
              'Turborepo',
            ].map((tech) => (
              <Badge key={tech} variant="outline" className="px-3 py-1 text-sm">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-gradient-to-br from-primary/5 via-white to-secondary/5 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Ready to launch your workspace?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            The setup wizard takes just a few minutes. Pick a template, configure
            your AI team, and start running your business smarter.
          </p>
          <div className="mt-8">
            <Link href="/wizard">
              <Button size="lg" className="text-base px-10">
                Start Setup Wizard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          <p>
            UniCore &mdash; Built by{' '}
            <span className="font-medium text-gray-700">BeMind Technology</span>
          </p>
          <p className="mt-1">
            Business Source License 1.1 &middot; Community Edition is free
            forever
          </p>
        </div>
      </footer>
    </div>
  );
}
