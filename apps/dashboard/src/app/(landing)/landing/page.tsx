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
} from 'lucide-react';

const agents = [
  { name: 'Router', icon: Router, desc: 'Intelligent task routing to the right agent' },
  { name: 'Comms', icon: MessageSquare, desc: 'Multi-channel communication management' },
  { name: 'Finance', icon: DollarSign, desc: 'Invoicing, expenses, and financial insights' },
  { name: 'Growth', icon: TrendingUp, desc: 'Marketing campaigns and analytics' },
  { name: 'Ops', icon: Settings, desc: 'Operations, inventory, and logistics' },
  { name: 'Research', icon: Search, desc: 'Market research and competitor analysis' },
  { name: 'Builder', icon: Hammer, desc: 'Workflow and integration builder' },
  { name: 'ERP', icon: Database, desc: 'Full enterprise resource planning suite' },
];

const erpModules = [
  { name: 'Contacts', icon: Users },
  { name: 'Orders', icon: ShoppingCart },
  { name: 'Inventory', icon: Boxes },
  { name: 'Invoicing', icon: FileText },
  { name: 'Expenses', icon: Receipt },
  { name: 'Reports', icon: BarChart3 },
];

const communityFeatures = [
  '2 AI agents',
  '3 user roles',
  'Basic ERP modules',
  'Basic workflows',
  'Community support',
  'Self-hosted',
];

const proFeatures = [
  '50 AI agents',
  '20 user roles',
  'All ERP modules',
  'Advanced workflows',
  'Priority support',
  'Cloud or self-hosted',
  'Custom integrations',
  'Audit logs & compliance',
];

const showcaseItems = [
  {
    icon: Gamepad2,
    title: 'Pixel Art Backoffice',
    desc: 'A unique retro-styled agent workspace that makes managing your business feel like an adventure. Each agent has its own pixel character and personality.',
  },
  {
    icon: Terminal,
    title: 'AI Commander',
    desc: 'Prompt any agent using natural language. Just describe what you need and the Router agent delegates to the right specialist automatically.',
  },
  {
    icon: KanbanSquare,
    title: 'Task Board',
    desc: 'Kanban-style task management with drag-and-drop. Agents can create, update, and complete tasks across your entire organization.',
  },
  {
    icon: MessagesSquare,
    title: 'Real-time Chat',
    desc: 'Talk to your AI agents directly in a chat interface. Get instant answers, reports, and actions without leaving the conversation.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* Logo mark */}
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

            <p className="max-w-2xl text-lg text-muted-foreground">
              8 specialized AI agents. Full ERP. Workflow automation. One platform.
            </p>

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
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A unified platform that combines AI-powered agents with enterprise tools
            to run your entire business.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="border-2 hover:border-primary/40 transition-colors">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <Bot className="h-6 w-6" />
              </div>
              <CardTitle className="text-lg">AI-Powered Agents</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-sm">
                8 specialized agents that handle communication, finance, growth,
                operations, and more — all coordinated by an intelligent router.
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
                Contacts, orders, inventory, invoicing, expenses, and reports.
                Everything you need to manage your business in one place.
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
                Build custom workflows with a visual editor. Connect agents, triggers,
                and actions to automate any business process.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Built by <span className="font-medium text-foreground">BeMind Technology</span>
        </p>
      </section>

      <Separator />

      {/* ── Features Grid ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Powerful Features
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            8 AI agents working together, plus a full ERP suite and integrations
            with the tools you already use.
          </p>
        </div>

        {/* Agent cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {agents.map((agent) => (
            <Card key={agent.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <agent.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{agent.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ERP module badges */}
        <div className="text-center space-y-4 mb-10">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            ERP Modules
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {erpModules.map((mod) => (
              <Badge
                key={mod.name}
                variant="secondary"
                className="px-4 py-2 text-sm gap-2"
              >
                <mod.icon className="h-4 w-4" />
                {mod.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Integration logos */}
        <div className="text-center space-y-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Integrations
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {['LINE', 'Telegram', 'Slack', 'Kafka'].map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground"
              >
                <Globe className="h-4 w-4" />
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Separator />

      {/* ── Pricing Section ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Simple Pricing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Start free with the Community edition. Upgrade to Pro when you need more
            power.
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
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <X className="h-4 w-4 flex-shrink-0" />
                  Custom integrations
                </li>
                <li className="flex items-center gap-3 text-sm text-muted-foreground">
                  <X className="h-4 w-4 flex-shrink-0" />
                  Audit logs & compliance
                </li>
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
            See it in Action
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explore the unique features that make UniCore stand out from traditional
            business tools.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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
              Wizard
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
          </nav>

          {/* Made with love */}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Made with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> in Thailand by{' '}
            <span className="font-medium text-foreground">BeMind Technology</span>
          </p>

          {/* Tech stack */}
          <div className="flex flex-wrap justify-center gap-2">
            {['Next.js', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka', 'Qdrant'].map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {tech}
              </Badge>
            ))}
          </div>

          <Separator className="max-w-xs" />

          <p className="text-xs text-muted-foreground">
            &copy; 2026 BeMind Technology. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
