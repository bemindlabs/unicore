import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Separator,
} from '@unicore/ui';
import {
  Bot,
  Package,
  GitBranch,
  Router,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Settings,
  Search,
  Hammer,
  Database,
  Users,
  ShoppingCart,
  Boxes,
  FileText,
  Receipt,
  BarChart3,
  Gamepad2,
  Terminal,
  KanbanSquare,
  MessagesSquare,
  ArrowRight,
  Check,
  X,
  Sparkles,
  Zap,
  Globe,
  Heart,
  LayoutDashboard,
  BookOpen,
  History,
  Workflow,
  Shield,
  Activity,
  Server,
  Lock,
  Radio,
  Send,
  MonitorCheck,
  ScrollText,
  ChevronRight,
  Container,
  Cog,
  UserCog,
  Cable,
  Brain,
} from 'lucide-react';

/* ── Data ── */

const agents = [
  {
    name: 'Router',
    icon: Router,
    desc: 'Intent classification and intelligent task delegation to the right specialist agent.',
    color: 'from-violet-500/20 to-violet-500/5',
  },
  {
    name: 'Comms',
    icon: MessageSquare,
    desc: 'Customer communication across LINE, Telegram, and other channels with unified inbox.',
    color: 'from-blue-500/20 to-blue-500/5',
  },
  {
    name: 'Finance',
    icon: DollarSign,
    desc: 'Automated invoicing, expense tracking, payment recording, and financial reports.',
    color: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    name: 'Growth',
    icon: TrendingUp,
    desc: 'Marketing campaign management, customer analytics, and growth optimization.',
    color: 'from-orange-500/20 to-orange-500/5',
  },
  {
    name: 'Ops',
    icon: Cog,
    desc: 'System monitoring, deployment management, and operational health tracking.',
    color: 'from-slate-500/20 to-slate-500/5',
  },
  {
    name: 'Research',
    icon: Search,
    desc: 'Market research, competitor analysis, and data-driven business intelligence.',
    color: 'from-cyan-500/20 to-cyan-500/5',
  },
  {
    name: 'Builder',
    icon: Hammer,
    desc: 'Code generation, feature implementation, and workflow construction.',
    color: 'from-amber-500/20 to-amber-500/5',
  },
  {
    name: 'ERP',
    icon: Database,
    desc: 'Automated data entry, record management, and ERP workflow orchestration.',
    color: 'from-rose-500/20 to-rose-500/5',
  },
];

const erpModules = [
  {
    name: 'Contacts CRM',
    icon: Users,
    desc: 'Full CRUD, contact types, lead scoring, and customer lifecycle management.',
  },
  {
    name: 'Orders',
    icon: ShoppingCart,
    desc: 'Status workflow: pending, confirmed, processing, shipped, fulfilled.',
  },
  {
    name: 'Inventory',
    icon: Boxes,
    desc: 'Real-time stock levels, low stock alerts, and inventory adjustments.',
  },
  {
    name: 'Invoicing',
    icon: FileText,
    desc: 'Draft to sent to paid workflow with payment recording and tracking.',
  },
  {
    name: 'Expenses',
    icon: Receipt,
    desc: 'Expense categories, submission workflow, and approval management.',
  },
  {
    name: 'Reports',
    icon: BarChart3,
    desc: 'Revenue analytics, inventory reports, top products, and top contacts.',
  },
];

const dashboardFeatures = [
  { name: 'Real-time Widgets', icon: Activity, desc: 'Revenue, orders, inventory, MRR, churn, signups, and activity charts' },
  { name: 'AI Agents Overview', icon: Bot, desc: 'Status cards showing agent health, activity, and task assignments' },
  { name: 'Knowledge Base', icon: BookOpen, desc: 'Document upload with RAG-powered vector search via Qdrant' },
  { name: 'Chat History', icon: History, desc: 'Searchable conversation archive across all agent interactions' },
  { name: 'Tasks Board', icon: KanbanSquare, desc: 'Kanban and list views with drag-and-drop, backed by PostgreSQL' },
  { name: 'Workflows', icon: Workflow, desc: 'CRUD operations, manual triggers, and Kafka event-driven automation' },
];

const backofficeFeatures = [
  { name: 'RetroDeck Workspace', icon: Gamepad2, desc: 'Pixel art themed workspace with 5 unique agent characters' },
  { name: 'Command Center', icon: Terminal, desc: 'Prompt any agent with natural language commands' },
  { name: 'Agent Terminal', icon: MonitorCheck, desc: 'Per-agent CLI interface for direct interaction' },
  { name: 'Agent Settings', icon: Settings, desc: 'Configure autonomy levels, channels, and capabilities' },
  { name: 'Real-time Chat', icon: MessagesSquare, desc: 'Broadcast and 1:1 messaging with emoji reactions' },
  { name: 'Smart Features', icon: Sparkles, desc: '@mentions, notification sounds, and full message search' },
];

const integrations = [
  { name: 'LINE', desc: 'Messaging API, webhooks, rich menus, Flex message templates', icon: Send },
  { name: 'Telegram', desc: 'Bot API, webhook handling, workflow action triggers', icon: Send },
  { name: 'Kafka', desc: 'Event-driven ERP workflows with real-time processing', icon: Cable },
  { name: 'OpenClaw', desc: 'WebSocket-based multi-agent communication framework', icon: Brain },
  { name: 'Qdrant', desc: 'Vector database powering RAG knowledge base search', icon: Database },
];

const infrastructure = [
  { name: '17 Docker Services', icon: Container },
  { name: 'Cloudflare SSL + CDN', icon: Lock },
  { name: 'Nginx Reverse Proxy', icon: Server },
  { name: 'PostgreSQL 16', icon: Database },
  { name: 'Redis 7 Caching', icon: Zap },
  { name: 'WebSocket Real-time', icon: Radio },
];

const adminFeatures = [
  { name: 'User Management', icon: UserCog },
  { name: 'Audit Logs', icon: ScrollText },
  { name: 'System Health', icon: Activity },
  { name: '5 Roles', icon: Shield },
];

const roles = ['Owner', 'Operator', 'Marketer', 'Finance', 'Viewer'];

const settingsFeatures = [
  'ERP module toggles',
  'Integration configs (Telegram, LINE)',
  'Custom domains management',
  'License management (Community vs Pro)',
  'Branding system (custom colors)',
  '6-step setup wizard',
];

const communityFeatures = [
  '2 AI agents',
  '3 user roles',
  'Basic ERP modules',
  'Dashboard with widgets',
  'Tasks board (Kanban + list)',
  'Knowledge base + RAG',
  'Workflow automation',
  'Community support',
  'Self-hosted deployment',
];

const proFeatures = [
  'Up to 50 AI agents',
  '20 user roles',
  'All ERP modules',
  'Advanced workflows + Kafka events',
  'LINE + Telegram integrations',
  'All messaging channels',
  'SSO authentication',
  'White-label branding',
  'Audit logs + compliance',
  'Custom domain support',
  'Priority support',
  'Cloud or self-hosted',
];

const communityExcluded = [
  'SSO authentication',
  'White-label branding',
  'Audit logs',
  'Custom domains',
];

const techStack = [
  { name: 'Next.js 14', category: 'Frontend' },
  { name: 'React 18', category: 'Frontend' },
  { name: 'TypeScript 5.5', category: 'Language' },
  { name: 'NestJS', category: 'Backend' },
  { name: 'Prisma ORM', category: 'Database' },
  { name: 'PostgreSQL 16', category: 'Database' },
  { name: 'Redis 7', category: 'Cache' },
  { name: 'Qdrant', category: 'Vectors' },
  { name: 'Kafka', category: 'Events' },
  { name: 'Tailwind CSS', category: 'Styling' },
  { name: 'shadcn/ui', category: 'Components' },
  { name: 'OpenClaw', category: 'AI Agents' },
];

const showcaseItems = [
  {
    icon: Gamepad2,
    title: 'Pixel Art Backoffice',
    desc: 'A retro-styled agent workspace (RetroDeck theme) where each of the 5 AI characters has its own pixel art avatar and personality. Managing your business feels like an adventure game.',
  },
  {
    icon: Terminal,
    title: 'Command Center',
    desc: 'Prompt any agent using natural language. Describe what you need and the Router agent classifies intent, then delegates to the right specialist automatically.',
  },
  {
    icon: KanbanSquare,
    title: 'Tasks Board',
    desc: 'Full Kanban and list view task management with drag-and-drop. PostgreSQL-backed with real-time sync. Agents can create, update, and complete tasks across your organization.',
  },
  {
    icon: MessagesSquare,
    title: 'Real-time Agent Chat',
    desc: 'Broadcast and 1:1 direct messaging with your AI agents. Includes emoji reactions, @mentions, notification sounds, and full message search.',
  },
  {
    icon: BookOpen,
    title: 'Knowledge Base + RAG',
    desc: 'Upload documents and let Qdrant-powered vector search make your knowledge instantly accessible. Agents reference your docs to give context-aware answers.',
  },
  {
    icon: Workflow,
    title: 'Event-Driven Workflows',
    desc: 'Build workflows with CRUD operations and manual triggers. Kafka integration enables event-driven automation that connects your ERP modules and agents seamlessly.',
  },
];

/* ── Page ── */

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl shadow-lg">
              U
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                UniCore
              </span>
            </h1>

            <p className="text-xl sm:text-2xl font-semibold text-foreground/90">
              AI-First Business Ecosystem for Solopreneurs
            </p>

            <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
              8 specialized AI agents. Full ERP with 6 modules. 25+ dashboard pages.
              Kafka-driven workflows. LINE and Telegram integrations.
              One self-hosted platform that runs your entire business.
            </p>

            {/* Stats bar */}
            <div className="flex flex-wrap justify-center gap-6 sm:gap-10 pt-2">
              {[
                { value: '8', label: 'AI Agents' },
                { value: '25+', label: 'Dashboard Pages' },
                { value: '6', label: 'ERP Modules' },
                { value: '17', label: 'Docker Services' },
                { value: '5', label: 'User Roles' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center">
                  <span className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</span>
                  <span className="text-xs sm:text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button asChild size="lg" className="text-base px-8">
                <Link href="/wizard">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base px-8">
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── About Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            What is UniCore?
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            UniCore is a unified, self-hosted platform that combines 8 AI-powered agents
            with a complete ERP suite, workflow automation, and multi-channel integrations.
            Built for solopreneurs and small teams who want enterprise-grade tools
            without enterprise complexity.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2 hover:border-primary/40 transition-colors">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Bot className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">8 AI Agents</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm">
                Specialized agents for routing, communication, finance, growth,
                ops, research, building, and ERP — coordinated by an intelligent router.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/40 transition-colors">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Package className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Complete ERP</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm">
                Contacts CRM, orders, inventory, invoicing, expenses, and reports.
                Full status workflows, lead scoring, and real-time stock alerts.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/40 transition-colors">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Gamepad2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Pixel Art Backoffice</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm">
                A retro-styled RetroDeck workspace with 5 pixel art characters.
                Command center, agent terminal, real-time chat with reactions and mentions.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/40 transition-colors">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <GitBranch className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">Workflow Automation</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm">
                Event-driven workflows powered by Kafka. Manual triggers, CRUD operations,
                and seamless agent-to-ERP automation pipelines.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          Built by{' '}
          <a href="mailto:info@bemind.tech" className="font-medium text-foreground hover:text-primary transition-colors">
            BeMind Technology
          </a>
          {' '}&mdash; Made in Thailand
        </p>
      </section>

      <Separator />

      {/* ── AI Agents Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
            <Bot className="h-3 w-3 mr-1.5" />
            Multi-Agent System
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            8 Specialized AI Agents
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Each agent is a specialist. The Router classifies intent and delegates tasks
            to the right agent automatically. Powered by the OpenClaw multi-agent framework.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {agents.map((agent) => (
            <Card key={agent.name} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${agent.color} text-primary group-hover:scale-110 transition-transform`}>
                    <agent.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{agent.name} Agent</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{agent.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Dashboard Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
            <LayoutDashboard className="h-3 w-3 mr-1.5" />
            25+ Pages
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Full-Featured Dashboard
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real-time widgets, AI agent management, knowledge base with RAG search,
            task boards, and event-driven workflow automation.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboardFeatures.map((feature) => (
            <Card key={feature.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{feature.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── ERP Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
            <Package className="h-3 w-3 mr-1.5" />
            Enterprise Resource Planning
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            6 ERP Modules
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A complete business management suite with CRM, order processing,
            inventory tracking, invoicing, expense management, and reporting.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {erpModules.map((mod) => (
            <Card key={mod.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <mod.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{mod.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{mod.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Backoffice Section ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="text-center space-y-4 mb-12">
            <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
              <Gamepad2 className="h-3 w-3 mr-1.5" />
              RetroDeck Theme
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Pixel Art Backoffice
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A unique retro-styled agent workspace where managing your business
              feels like playing a game. 5 pixel art characters, real-time chat,
              and powerful command tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {backofficeFeatures.map((feature) => (
              <Card key={feature.name} className="hover:shadow-md transition-shadow bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{feature.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Integrations Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
            <Globe className="h-3 w-3 mr-1.5" />
            Connect Everything
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Integrations
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Connect with messaging platforms, event streams, and vector databases.
            Every integration is production-ready with webhook support and adapter patterns.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
          {integrations.map((integration) => (
            <Card key={integration.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                    <integration.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{integration.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Infrastructure + Admin Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Infrastructure */}
          <div>
            <div className="space-y-4 mb-8">
              <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
                <Server className="h-3 w-3 mr-1.5" />
                Infrastructure
              </Badge>
              <h3 className="text-2xl font-bold tracking-tight">
                Production-Ready Stack
              </h3>
              <p className="text-muted-foreground text-sm">
                17 Docker services with Cloudflare SSL, Nginx reverse proxy, and real-time WebSocket support.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {infrastructure.map((item) => (
                <div key={item.name} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <item.icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin + Settings */}
          <div>
            <div className="space-y-4 mb-8">
              <Badge variant="secondary" className="px-3 py-1 text-xs uppercase tracking-wider">
                <Shield className="h-3 w-3 mr-1.5" />
                Administration
              </Badge>
              <h3 className="text-2xl font-bold tracking-tight">
                Admin + Settings
              </h3>
              <p className="text-muted-foreground text-sm">
                User management, audit logging, system health monitoring, and role-based access control.
              </p>
            </div>

            <div className="space-y-4">
              {/* Admin features */}
              <div className="grid gap-3 sm:grid-cols-2">
                {adminFeatures.map((item) => (
                  <div key={item.name} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                    <item.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                ))}
              </div>

              {/* Roles */}
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Access Roles</p>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Settings list */}
              <div className="rounded-lg border px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Settings</p>
                <ul className="space-y-1.5">
                  {settingsFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-primary flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Pricing Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start free with the Community edition. Upgrade to Pro when you need
            more agents, roles, integrations, and enterprise features.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto">
          {/* Community */}
          <Card className="border-2 flex flex-col">
            <CardHeader>
              <CardTitle className="text-xl">Community</CardTitle>
              <CardDescription>Perfect for getting started</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">Free</span>
                <span className="text-muted-foreground ml-2">forever</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {communityFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
                {communityExcluded.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <X className="h-4 w-4 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant="outline">
                <Link href="/wizard">Start Free</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="border-2 border-primary flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="px-3 py-1">
                <Sparkles className="h-3 w-3 mr-1" />
                Recommended
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-xl">Pro</CardTitle>
              <CardDescription>For growing businesses</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">$49</span>
                <span className="text-muted-foreground ml-2">/month</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {proFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="mailto:info@bemind.tech">Contact Sales</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <Separator />

      {/* ── Showcase Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            See It in Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explore the unique features that make UniCore stand out from traditional
            business tools and generic SaaS platforms.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseItems.map((item) => (
            <Card key={item.title} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Tech Stack Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center space-y-4 mb-8">
          <h3 className="text-xl font-bold tracking-tight text-muted-foreground">
            Built With Modern Technology
          </h3>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {techStack.map((tech) => (
            <Badge key={tech.name} variant="outline" className="text-xs px-3 py-1.5">
              <Zap className="h-3 w-3 mr-1.5" />
              {tech.name}
            </Badge>
          ))}
        </div>
      </section>

      <Separator />

      {/* ── Footer ── */}
      <footer className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col items-center space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              U
            </div>
            <span className="text-lg font-semibold">UniCore</span>
          </div>

          {/* Navigation links */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link href="/wizard" className="hover:text-foreground transition-colors">
              Setup Wizard
            </Link>
            <a
              href="https://github.com/bemindlabs/unicore"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://github.com/bemindlabs/unicore#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href="mailto:info@bemind.tech"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a>
          </nav>

          {/* Made with love */}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Made with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> in Thailand by{' '}
            <span className="font-medium text-foreground">BeMind Technology</span>
          </p>

          <Separator className="max-w-xs" />

          <p className="text-xs text-muted-foreground">
            &copy; 2026 BeMind Technology (Pituk Kaewsuksai). All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
