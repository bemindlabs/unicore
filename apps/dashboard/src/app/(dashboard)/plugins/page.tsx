'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
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

type PluginCategory = 'all' | 'agents' | 'apps' | 'workflows' | 'channels' | 'analytics' | 'security';

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
  featured?: boolean;
  createdAt: string;
}

const MOCK_PLUGINS: Plugin[] = [
  {
    id: '1',
    slug: 'gpt-4o-agent',
    name: 'GPT-4o Agent',
    description: 'Deploy a powerful GPT-4o powered agent with advanced reasoning and multimodal capabilities.',
    author: 'OpenAI Labs',
    version: '2.1.0',
    category: 'agents',
    tags: ['gpt-4o', 'multimodal', 'reasoning'],
    rating: 4.8,
    reviewCount: 234,
    installCount: 15420,
    icon: '\u{1F916}',
    featured: true,
    createdAt: '2025-12-01',
  },
  {
    id: '2',
    slug: 'slack-channel',
    name: 'Slack Integration',
    description: 'Connect your UniCore agents to Slack workspaces with rich message formatting and event hooks.',
    author: 'UniCore Team',
    version: '1.4.2',
    category: 'channels',
    tags: ['slack', 'messaging', 'notifications'],
    rating: 4.6,
    reviewCount: 189,
    installCount: 12300,
    icon: '\u{1F4AC}',
    featured: true,
    createdAt: '2025-11-15',
  },
  {
    id: '3',
    slug: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'Funnel analysis, cohort tracking, retention metrics, and custom event dashboards.',
    author: 'DataCraft',
    version: '3.0.1',
    category: 'analytics',
    tags: ['analytics', 'metrics', 'dashboards'],
    rating: 4.7,
    reviewCount: 156,
    installCount: 9870,
    icon: '\u{1F4CA}',
    featured: true,
    createdAt: '2025-10-20',
  },
  {
    id: '4',
    slug: 'n8n-workflow-bridge',
    name: 'n8n Workflow Bridge',
    description: 'Bridge UniCore workflows with n8n automation flows for 400+ integrations.',
    author: 'n8n Community',
    version: '1.2.0',
    category: 'workflows',
    tags: ['n8n', 'automation', 'integration'],
    rating: 4.5,
    reviewCount: 98,
    installCount: 7650,
    icon: '\u{1F500}',
    createdAt: '2025-11-05',
  },
  {
    id: '5',
    slug: 'crm-pro-app',
    name: 'CRM Pro',
    description: 'Enhanced CRM with deal pipelines, email sequences, and lead scoring automation.',
    author: 'SalesTech Inc.',
    version: '2.3.0',
    category: 'apps',
    tags: ['crm', 'sales', 'pipeline'],
    rating: 4.4,
    reviewCount: 203,
    installCount: 11200,
    icon: '\u{1F3C6}',
    createdAt: '2025-09-30',
  },
  {
    id: '6',
    slug: 'waf-security',
    name: 'WAF & Security Monitor',
    description: 'Web Application Firewall with real-time threat detection and automatic IP blocking.',
    author: 'SecureCore Labs',
    version: '1.8.3',
    category: 'security',
    tags: ['waf', 'security', 'firewall'],
    rating: 4.9,
    reviewCount: 87,
    installCount: 5430,
    icon: '\u{1F6E1}\uFE0F',
    createdAt: '2025-12-10',
  },
  {
    id: '7',
    slug: 'discord-bot',
    name: 'Discord Bot Builder',
    description: 'Create and deploy Discord bots powered by your UniCore AI agents.',
    author: 'BotForge',
    version: '1.1.0',
    category: 'channels',
    tags: ['discord', 'bot', 'community'],
    rating: 4.3,
    reviewCount: 145,
    installCount: 8900,
    icon: '\u{1F3AE}',
    createdAt: '2025-11-28',
  },
  {
    id: '8',
    slug: 'langchain-agent',
    name: 'LangChain Agent',
    description: 'Run LangChain chains and agents directly within the UniCore agent framework.',
    author: 'LangChain OSS',
    version: '0.9.1',
    category: 'agents',
    tags: ['langchain', 'chains', 'tools'],
    rating: 4.2,
    reviewCount: 112,
    installCount: 6700,
    icon: '\u{1F517}',
    createdAt: '2025-10-15',
  },
  {
    id: '9',
    slug: 'zapier-connect',
    name: 'Zapier Connect',
    description: '5000+ app integrations via Zapier triggers and actions for your workflows.',
    author: 'Zapier Corp',
    version: '2.0.0',
    category: 'workflows',
    tags: ['zapier', 'automation', 'triggers'],
    rating: 4.6,
    reviewCount: 267,
    installCount: 19800,
    icon: '\u{26A1}',
    createdAt: '2025-08-20',
  },
  {
    id: '10',
    slug: 'hr-module',
    name: 'HR & Payroll Module',
    description: 'Employee management, leave tracking, payroll, and performance reviews.',
    author: 'HRCore',
    version: '1.5.2',
    category: 'apps',
    tags: ['hr', 'payroll', 'employees'],
    rating: 4.3,
    reviewCount: 78,
    installCount: 4200,
    icon: '\u{1F465}',
    createdAt: '2025-09-10',
  },
  {
    id: '11',
    slug: 'whatsapp-channel',
    name: 'WhatsApp Business',
    description: 'Official WhatsApp Business API integration with template messages and media support.',
    author: 'UniCore Team',
    version: '1.3.1',
    category: 'channels',
    tags: ['whatsapp', 'messaging', 'business'],
    rating: 4.7,
    reviewCount: 321,
    installCount: 22100,
    icon: '\u{1F4F1}',
    featured: true,
    createdAt: '2025-07-15',
  },
  {
    id: '12',
    slug: 'seo-analyzer',
    name: 'SEO Analyzer',
    description: 'AI-powered SEO analysis, keyword tracking, and content optimization suggestions.',
    author: 'SEOBot',
    version: '1.0.4',
    category: 'analytics',
    tags: ['seo', 'keywords', 'content'],
    rating: 4.1,
    reviewCount: 56,
    installCount: 3100,
    icon: '\u{1F50D}',
    createdAt: '2025-12-05',
  },
];

const CATEGORIES: { value: PluginCategory; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'apps', label: 'Apps', icon: Puzzle },
  { value: 'workflows', label: 'Workflows', icon: GitBranch },
  { value: 'channels', label: 'Channels', icon: MessageSquare },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'security', label: 'Security', icon: Shield },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
];

async function fetchPluginsFromAPI(): Promise<Plugin[] | null> {
  try {
    const res = await fetch('/api/proxy/ai/plugins', {
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

function PluginCard({ plugin, onSelect }: { plugin: Plugin; onSelect: (plugin: Plugin) => void }) {
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={() => onSelect(plugin)}
    >
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
          <div className="flex flex-wrap gap-1">
            {plugin.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs">
                {tag}
              </Badge>
            ))}
            <Badge variant="outline" className="px-1.5 py-0 text-xs capitalize">
              {plugin.category}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </button>
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
              {plugin.category}
            </Badge>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">
              Published {new Date(plugin.createdAt).toLocaleDateString()}
            </span>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline" size="sm">
                  Close
                </Button>
              </DialogClose>
              <Button
                size="sm"
                disabled
                className="relative"
                title="Plugin installation is coming soon"
              >
                Install
                <Badge
                  variant="secondary"
                  className="ml-2 px-1.5 py-0 text-[10px] font-normal"
                >
                  Coming Soon
                </Badge>
              </Button>
            </div>
          </div>

          {isPreview && (
            <p className="text-xs text-muted-foreground italic">
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

  const handleSelectPlugin = useCallback((plugin: Plugin) => {
    setSelectedPlugin(plugin);
    setDetailOpen(true);
  }, []);

  const featured = plugins.filter((p) => p.featured);

  const filtered = useMemo(() => {
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
            placeholder="Search plugins..."
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

      {/* Featured — shown only with no active search/filter */}
      {!search && category === 'all' && featured.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Featured</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((plugin) => (
              <PluginCard key={plugin.id} plugin={plugin} onSelect={handleSelectPlugin} />
            ))}
          </div>
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
            {filtered.length === 0 ? (
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((plugin) => (
                  <PluginCard key={plugin.id} plugin={plugin} onSelect={handleSelectPlugin} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer stats */}
      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{filtered.length} plugin{filtered.length !== 1 ? 's' : ''}</span>
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
