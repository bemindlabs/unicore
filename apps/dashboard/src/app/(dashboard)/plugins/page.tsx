'use client';

// Updated: 2026-03-23

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Bot,
  Search,
  Star,
  Download,
  Puzzle,
  GitBranch,
  MessageSquare,
  BarChart3,
  Shield,
  Layers,
  TrendingUp,
  Sparkles,
  ArrowUpDown,
  Info,
  Database,
  Code2,
  Palette,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@unicore/ui';

type PluginCategory =
  | 'all'
  | 'agents'
  | 'apps'
  | 'workflows'
  | 'channels'
  | 'data'
  | 'analytics'
  | 'security'
  | 'dev-tools'
  | 'themes';

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: Exclude<PluginCategory, 'all'>;
  tags: string[];
  rating: number;
  reviewCount: number;
  installCount: number;
  icon: string;
  price: number | null;
  featured?: boolean;
  createdAt: string;
}

const MOCK_PLUGINS: Plugin[] = [
  {
    id: '1', slug: 'gpt-4o-agent', name: 'GPT-4o Agent',
    description: 'Deploy a powerful GPT-4o powered agent with advanced reasoning and multimodal capabilities.',
    author: 'OpenAI Labs', version: '2.1.0', category: 'agents',
    tags: ['gpt-4o', 'multimodal', 'reasoning'], rating: 4.8, reviewCount: 234,
    installCount: 15420, icon: '🤖', price: null, featured: true, createdAt: '2025-12-01',
  },
  {
    id: '2', slug: 'slack-channel', name: 'Slack Integration',
    description: 'Connect your UniCore agents to Slack workspaces with rich message formatting and event hooks.',
    author: 'UniCore Team', version: '1.4.2', category: 'channels',
    tags: ['slack', 'messaging', 'notifications'], rating: 4.6, reviewCount: 189,
    installCount: 12300, icon: '💬', price: null, featured: true, createdAt: '2025-11-15',
  },
  {
    id: '3', slug: 'advanced-analytics', name: 'Advanced Analytics',
    description: 'Funnel analysis, cohort tracking, retention metrics, and custom event dashboards.',
    author: 'DataCraft', version: '3.0.1', category: 'analytics',
    tags: ['analytics', 'metrics', 'dashboards'], rating: 4.7, reviewCount: 156,
    installCount: 9870, icon: '📊', price: 29, featured: true, createdAt: '2025-10-20',
  },
  {
    id: '4', slug: 'n8n-workflow-bridge', name: 'n8n Workflow Bridge',
    description: 'Bridge UniCore workflows with n8n automation flows for 400+ integrations.',
    author: 'n8n Community', version: '1.2.0', category: 'workflows',
    tags: ['n8n', 'automation', 'integration'], rating: 4.5, reviewCount: 98,
    installCount: 7650, icon: '🔀', price: null, createdAt: '2025-11-05',
  },
  {
    id: '5', slug: 'crm-pro-app', name: 'CRM Pro',
    description: 'Enhanced CRM with deal pipelines, email sequences, and lead scoring automation.',
    author: 'SalesTech Inc.', version: '2.3.0', category: 'apps',
    tags: ['crm', 'sales', 'pipeline'], rating: 4.4, reviewCount: 203,
    installCount: 11200, icon: '🏆', price: 49, createdAt: '2025-09-30',
  },
  {
    id: '6', slug: 'waf-security', name: 'WAF & Security Monitor',
    description: 'Web Application Firewall with real-time threat detection and automatic IP blocking.',
    author: 'SecureCore Labs', version: '1.8.3', category: 'security',
    tags: ['waf', 'security', 'firewall'], rating: 4.9, reviewCount: 87,
    installCount: 5430, icon: '🛡️', price: 19, featured: true, createdAt: '2025-12-10',
  },
  {
    id: '7', slug: 'discord-bot', name: 'Discord Bot Builder',
    description: 'Create and deploy Discord bots powered by your UniCore AI agents.',
    author: 'BotForge', version: '1.1.0', category: 'channels',
    tags: ['discord', 'bot', 'community'], rating: 4.3, reviewCount: 145,
    installCount: 8900, icon: '🎮', price: null, createdAt: '2025-11-28',
  },
  {
    id: '8', slug: 'langchain-agent', name: 'LangChain Agent',
    description: 'Run LangChain chains and agents directly within the UniCore agent framework.',
    author: 'LangChain OSS', version: '0.9.1', category: 'agents',
    tags: ['langchain', 'chains', 'tools'], rating: 4.2, reviewCount: 112,
    installCount: 6700, icon: '🔗', price: null, createdAt: '2025-10-15',
  },
  {
    id: '9', slug: 'zapier-connect', name: 'Zapier Connect',
    description: '5000+ app integrations via Zapier triggers and actions for your workflows.',
    author: 'Zapier Corp', version: '2.0.0', category: 'workflows',
    tags: ['zapier', 'automation', 'triggers'], rating: 4.6, reviewCount: 267,
    installCount: 19800, icon: '⚡', price: null, createdAt: '2025-08-20',
  },
  {
    id: '10', slug: 'hr-module', name: 'HR & Payroll Module',
    description: 'Employee management, leave tracking, payroll, and performance reviews.',
    author: 'HRCore', version: '1.5.2', category: 'apps',
    tags: ['hr', 'payroll', 'employees'], rating: 4.3, reviewCount: 78,
    installCount: 4200, icon: '👥', price: 39, createdAt: '2025-09-10',
  },
  {
    id: '11', slug: 'whatsapp-channel', name: 'WhatsApp Business',
    description: 'Official WhatsApp Business API integration with template messages and media support.',
    author: 'UniCore Team', version: '1.3.1', category: 'channels',
    tags: ['whatsapp', 'messaging', 'business'], rating: 4.7, reviewCount: 321,
    installCount: 22100, icon: '📱', price: null, featured: true, createdAt: '2025-07-15',
  },
  {
    id: '12', slug: 'seo-analyzer', name: 'SEO Analyzer',
    description: 'AI-powered SEO analysis, keyword tracking, and content optimization suggestions.',
    author: 'SEOBot', version: '1.0.4', category: 'analytics',
    tags: ['seo', 'keywords', 'content'], rating: 4.1, reviewCount: 56,
    installCount: 3100, icon: '🔍', price: 15, createdAt: '2025-12-05',
  },
  {
    id: '13', slug: 'postgres-connector', name: 'PostgreSQL Connector',
    description: 'Query and sync PostgreSQL databases directly from workflows and agents.',
    author: 'DataBridge Labs', version: '1.0.0', category: 'data',
    tags: ['postgres', 'database', 'sql'], rating: 4.6, reviewCount: 94,
    installCount: 8100, icon: '🗄️', price: null, featured: true, createdAt: '2025-11-20',
  },
  {
    id: '14', slug: 'csv-importer', name: 'CSV / Excel Importer',
    description: 'Bulk import and transform CSV and Excel files into structured data with AI mapping.',
    author: 'SheetFlow', version: '2.0.3', category: 'data',
    tags: ['csv', 'excel', 'import'], rating: 4.4, reviewCount: 132,
    installCount: 10500, icon: '📋', price: null, createdAt: '2025-10-10',
  },
  {
    id: '15', slug: 'redis-cache', name: 'Redis Cache Manager',
    description: 'Manage Redis caches, TTL policies, and key patterns from a visual dashboard.',
    author: 'CacheOps', version: '1.2.1', category: 'data',
    tags: ['redis', 'cache', 'performance'], rating: 4.3, reviewCount: 41,
    installCount: 2900, icon: '⚡', price: 9, createdAt: '2025-12-08',
  },
  {
    id: '16', slug: 'api-tester', name: 'API Tester',
    description: 'Postman-like REST and GraphQL client embedded in your UniCore dashboard.',
    author: 'DevKit', version: '1.5.0', category: 'dev-tools',
    tags: ['api', 'rest', 'testing'], rating: 4.7, reviewCount: 178,
    installCount: 13600, icon: '🔧', price: null, featured: true, createdAt: '2025-09-25',
  },
  {
    id: '17', slug: 'log-viewer', name: 'Log Viewer Pro',
    description: 'Real-time log streaming, structured search, and alerting for all UniCore services.',
    author: 'LogStack', version: '2.1.0', category: 'dev-tools',
    tags: ['logs', 'monitoring', 'debugging'], rating: 4.5, reviewCount: 89,
    installCount: 7200, icon: '📝', price: 12, createdAt: '2025-11-01',
  },
  {
    id: '18', slug: 'openapi-generator', name: 'OpenAPI Generator',
    description: 'Auto-generate TypeScript and Python SDK clients from your OpenAPI 3.0 specs.',
    author: 'CodeGen OSS', version: '1.0.0', category: 'dev-tools',
    tags: ['openapi', 'sdk', 'codegen'], rating: 4.2, reviewCount: 54,
    installCount: 4400, icon: '⚙️', price: null, createdAt: '2025-12-12',
  },
  {
    id: '19', slug: 'dark-pro-theme', name: 'Dark Pro Theme',
    description: 'Sleek dark theme with customizable accent colors, glassmorphism panels, and smooth animations.',
    author: 'UniCore Design', version: '1.0.0', category: 'themes',
    tags: ['dark', 'design', 'ui'], rating: 4.8, reviewCount: 203,
    installCount: 18700, icon: '🌙', price: null, featured: true, createdAt: '2025-10-30',
  },
  {
    id: '20', slug: 'retro-terminal-theme', name: 'Retro Terminal',
    description: 'Green-on-black terminal aesthetic with scan-line effects and monospace typography.',
    author: 'RetroUI', version: '2.0.0', category: 'themes',
    tags: ['retro', 'terminal', 'green'], rating: 4.6, reviewCount: 117,
    installCount: 9300, icon: '💻', price: null, createdAt: '2025-11-10',
  },
  {
    id: '21', slug: 'brand-kit-theme', name: 'Brand Kit',
    description: 'Upload your logo and set brand colors — generate a fully customized white-label dashboard.',
    author: 'WhiteLabel Studio', version: '1.4.0', category: 'themes',
    tags: ['branding', 'white-label', 'custom'], rating: 4.5, reviewCount: 76,
    installCount: 5800, icon: '🎨', price: 19, createdAt: '2025-09-18',
  },
];

const CATEGORIES: { value: PluginCategory; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'agents', label: 'AI Agents', icon: Bot },
  { value: 'apps', label: 'Apps', icon: Puzzle },
  { value: 'workflows', label: 'Workflows', icon: GitBranch },
  { value: 'channels', label: 'Channels', icon: MessageSquare },
  { value: 'data', label: 'Data', icon: Database },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'dev-tools', label: 'Dev Tools', icon: Code2 },
  { value: 'themes', label: 'Themes', icon: Palette },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
];

const PAGE_SIZE = 12;

async function fetchPluginsFromAPI(): Promise<Plugin[] | null> {
  try {
    const res = await fetch('/api/proxy/bootstrap/plugins', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
    return null;
  } catch {
    return null;
  }
}

function PriceLabel({ price }: { price: number | null }) {
  if (price === null) {
    return <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Free</span>;
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-foreground">
      <DollarSign className="h-3 w-3" />
      {price}/mo
    </span>
  );
}

function PluginCard({ plugin, onSelect }: { plugin: Plugin; onSelect: (plugin: Plugin) => void }) {
  return (
    <button type="button" className="w-full text-left" onClick={() => onSelect(plugin)}>
      <Card className="h-full cursor-pointer transition-all hover:bg-muted/40 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">
              {plugin.icon}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base leading-tight">{plugin.name}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">by {plugin.author}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardDescription className="line-clamp-2 text-sm">{plugin.description}</CardDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-medium">{plugin.rating}</span>
              <span className="text-xs text-muted-foreground">({plugin.reviewCount})</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Download className="h-3 w-3" />
              <span>{plugin.installCount.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {plugin.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
            <PriceLabel price={plugin.price} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function FeaturedCarousel({
  plugins,
  onSelect,
}: {
  plugins: Plugin[];
  onSelect: (plugin: Plugin) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => el.removeEventListener('scroll', updateScrollState);
  }, [updateScrollState]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -(el.clientWidth * 0.75) : el.clientWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute -left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute -right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md hover:bg-muted"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {plugins.map((plugin) => (
          <div key={plugin.id} className="w-64 flex-shrink-0">
            <PluginCard plugin={plugin} onSelect={onSelect} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PluginPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            className="h-8 w-8 p-0 text-xs"
            onClick={() => onChange(p as number)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PluginDetailDialog({
  plugin,
  open,
  onClose,
  isPreview,
}: {
  plugin: Plugin | null;
  open: boolean;
  onClose: () => void;
  isPreview: boolean;
}) {
  if (!plugin) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-3xl">
              {plugin.icon}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{plugin.name}</DialogTitle>
              <DialogDescription className="mt-1">
                by {plugin.author} &middot; v{plugin.version}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-foreground">{plugin.description}</p>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{plugin.rating}</span>
              <span className="text-muted-foreground">({plugin.reviewCount} reviews)</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>{plugin.installCount.toLocaleString()} installs</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {plugin.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            <Badge variant="outline" className="text-xs capitalize">
              {plugin.category.replace('-', ' ')}
            </Badge>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Published {new Date(plugin.createdAt).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Price:</span>
                <PriceLabel price={plugin.price} />
              </div>
            </div>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
              <Button size="sm" disabled className="relative" title="Plugin installation is coming soon">
                Install
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] font-normal">
                  Coming Soon
                </Badge>
              </Button>
            </div>
          </div>

          {isPreview && (
            <p className="text-xs italic text-muted-foreground">
              This is sample data. Live plugin details will be available when the Plugin API is connected.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PluginsMarketplacePage() {
  const [category, setCategory] = useState<PluginCategory>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS);
  const [isPreview, setIsPreview] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchPluginsFromAPI().then((data) => {
      if (cancelled) return;
      if (data) {
        setPlugins(data);
        setIsPreview(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setPage(1); }, [category, search, sort]);

  const handleSelectPlugin = useCallback((plugin: Plugin) => {
    setSelectedPlugin(plugin);
    setDetailOpen(true);
  }, []);

  const featured = useMemo(() => plugins.filter((p) => p.featured), [plugins]);

  const allFiltered = useMemo(() => {
    let result = plugins;
    if (category !== 'all') result = result.filter((p) => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q)),
      );
    }
    if (sort === 'popular') result = [...result].sort((a, b) => b.installCount - a.installCount);
    else if (sort === 'rating') result = [...result].sort((a, b) => b.rating - a.rating);
    else result = [...result].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  }, [plugins, category, search, sort]);

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
  const paginated = allFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showFeatured = !search && category === 'all' && featured.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Plugin Marketplace</h1>
              {isPreview && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Preview
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">Extend UniCore with community and official plugins</p>
          </div>
        </div>
        <div className="sm:ml-auto">
          <Button variant="outline" asChild>
            <Link href="/settings/plugins">Manage Installed</Link>
          </Button>
        </div>
      </div>

      {/* Preview Banner */}
      {isPreview && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/50">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="flex-1 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">Plugin Marketplace (Preview)</p>
            <p className="mt-0.5 text-blue-700 dark:text-blue-400">
              You are viewing sample plugins. The marketplace will be connected to the Plugin API in a future update.
              Plugin installation is not yet available.
            </p>
          </div>
        </div>
      )}

      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search plugins by name, author, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-48">
            <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Featured Carousel */}
      {showFeatured && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured</h2>
          </div>
          <FeaturedCarousel plugins={featured} onSelect={handleSelectPlugin} />
        </div>
      )}

      {/* Category Tabs */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as PluginCategory)}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {CATEGORIES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-4">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Puzzle className="mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-muted-foreground">No plugins found</p>
                {search && (
                  <Button variant="link" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginated.map((plugin) => (
                    <PluginCard key={plugin.id} plugin={plugin} onSelect={handleSelectPlugin} />
                  ))}
                </div>
                <PluginPagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer stats */}
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>
          {allFiltered.length} plugin{allFiltered.length !== 1 ? 's' : ''}
          {totalPages > 1 && (
            <span className="ml-1 text-muted-foreground/70">
              · page {page} of {totalPages}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>{plugins.reduce((sum, p) => sum + p.installCount, 0).toLocaleString()} total installs</span>
        </div>
      </div>

      {/* Plugin Detail Dialog */}
      <PluginDetailDialog
        plugin={selectedPlugin}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        isPreview={isPreview}
      />
    </div>
  );
}
