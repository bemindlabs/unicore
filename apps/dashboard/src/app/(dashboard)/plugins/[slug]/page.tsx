// Updated: 2026-03-23
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Download,
  Package,
  User,
  Calendar,
  Tag,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  History,
  MessageSquare,
  Puzzle,
  Bot,
  GitBranch,
  BarChart3,
  Plus,
  Trash2,
  Save,
  Settings2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@unicore/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PluginCategory = 'agents' | 'apps' | 'workflows' | 'channels' | 'analytics' | 'security';

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  author: string;
  authorEmail: string;
  authorWebsite: string;
  version: string;
  category: PluginCategory;
  tags: string[];
  rating: number;
  reviewCount: number;
  installCount: number;
  icon: string;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
  versionHistory: { version: string; date: string; changes: string[] }[];
  reviews: { id: string; author: string; rating: number; comment: string; date: string }[];
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PLUGINS: Plugin[] = [
  {
    id: '1',
    slug: 'gpt-4o-agent',
    name: 'GPT-4o Agent',
    description: 'Deploy a powerful GPT-4o powered agent with advanced reasoning and multimodal capabilities.',
    longDescription:
      'The GPT-4o Agent plugin integrates OpenAI\'s most advanced multimodal model directly into your UniCore agent framework. It supports text, image, and audio inputs with state-of-the-art reasoning capabilities. Configure system prompts, tool use, and streaming responses from the dashboard. Ideal for complex reasoning tasks, document analysis, and code generation pipelines.',
    author: 'OpenAI Labs',
    authorEmail: 'plugins@openai.com',
    authorWebsite: 'https://openai.com',
    version: '2.1.0',
    category: 'agents',
    tags: ['gpt-4o', 'multimodal', 'reasoning'],
    rating: 4.8,
    reviewCount: 234,
    installCount: 15420,
    icon: '🤖',
    featured: true,
    createdAt: '2025-12-01',
    updatedAt: '2026-02-15',
    permissions: [
      'Read conversation history',
      'Send messages on behalf of agents',
      'Access AI engine configuration',
      'Make outbound API calls to OpenAI',
    ],
    versionHistory: [
      { version: '2.1.0', date: '2026-02-15', changes: ['GPT-4o-mini fallback support', 'Improved streaming latency', 'Vision input pipeline'] },
      { version: '2.0.0', date: '2026-01-10', changes: ['Full GPT-4o support', 'Tool calling v2', 'Structured output mode'] },
      { version: '1.5.3', date: '2025-12-20', changes: ['Bug fix: token count overflow on long contexts', 'Added cost tracking'] },
      { version: '1.5.0', date: '2025-12-01', changes: ['Initial public release', 'GPT-4 Turbo support'] },
    ],
    reviews: [
      { id: 'r1', author: 'Alice M.', rating: 5, comment: 'Works flawlessly. The multimodal support is a game changer for our document processing pipeline.', date: '2026-03-01' },
      { id: 'r2', author: 'Bob K.', rating: 5, comment: 'Best agent plugin in the marketplace. Setup was straightforward and streaming is buttery smooth.', date: '2026-02-20' },
      { id: 'r3', author: 'Carol T.', rating: 4, comment: 'Great plugin overall. Would love better support for function calling with custom schemas.', date: '2026-02-10' },
      { id: 'r4', author: 'David R.', rating: 5, comment: 'Incredible value. Saved us weeks of integration work.', date: '2026-01-28' },
    ],
  },
  {
    id: '2',
    slug: 'slack-channel',
    name: 'Slack Integration',
    description: 'Connect your UniCore agents to Slack workspaces with rich message formatting and event hooks.',
    longDescription:
      'The Slack Integration plugin bridges UniCore with your Slack workspace, enabling bidirectional communication between your AI agents and team channels. Supports Block Kit message formatting, interactive components, slash commands, and real-time event subscriptions. Agents can post updates, respond to mentions, and trigger workflows from Slack actions.',
    author: 'UniCore Team',
    authorEmail: 'plugins@unicore.dev',
    authorWebsite: 'https://unicore.bemind.tech',
    version: '1.4.2',
    category: 'channels',
    tags: ['slack', 'messaging', 'notifications'],
    rating: 4.6,
    reviewCount: 189,
    installCount: 12300,
    icon: '💬',
    featured: true,
    createdAt: '2025-11-15',
    updatedAt: '2026-03-01',
    permissions: [
      'Read and write to Slack channels',
      'Manage Slack webhooks',
      'Access workspace member list',
      'Send direct messages',
    ],
    versionHistory: [
      { version: '1.4.2', date: '2026-03-01', changes: ['Support for Slack Connect channels', 'Fixed DM threading bug'] },
      { version: '1.4.0', date: '2026-01-20', changes: ['Block Kit v2 support', 'Interactive button callbacks'] },
      { version: '1.3.0', date: '2025-12-05', changes: ['Slash command routing', 'Event subscription manager'] },
      { version: '1.0.0', date: '2025-11-15', changes: ['Initial release'] },
    ],
    reviews: [
      { id: 'r1', author: 'Emma S.', rating: 5, comment: 'Our team uses this every day. The Block Kit support is excellent.', date: '2026-03-10' },
      { id: 'r2', author: 'Frank L.', rating: 4, comment: 'Solid integration. Would be 5 stars with better error logging.', date: '2026-02-25' },
      { id: 'r3', author: 'Grace P.', rating: 5, comment: 'Set up in under 10 minutes. Works perfectly with our agent workflows.', date: '2026-02-18' },
    ],
  },
  {
    id: '6',
    slug: 'waf-security',
    name: 'WAF & Security Monitor',
    description: 'Web Application Firewall with real-time threat detection and automatic IP blocking.',
    longDescription:
      'The WAF & Security Monitor plugin adds a comprehensive security layer to your UniCore deployment. It monitors all incoming requests, detects SQL injection, XSS, and CSRF attempts, and automatically blocks malicious IPs. The security dashboard provides real-time threat visualization, geo-blocking, rate limiting rules, and detailed audit logs for compliance reporting.',
    author: 'SecureCore Labs',
    authorEmail: 'security@securecore.io',
    authorWebsite: 'https://securecore.io',
    version: '1.8.3',
    category: 'security',
    tags: ['waf', 'security', 'firewall'],
    rating: 4.9,
    reviewCount: 87,
    installCount: 5430,
    icon: '🛡️',
    featured: false,
    createdAt: '2025-12-10',
    updatedAt: '2026-03-10',
    permissions: [
      'Read all incoming HTTP requests',
      'Block and allow IP addresses',
      'Write to security audit log',
      'Access nginx configuration',
      'Send security alerts via email',
    ],
    versionHistory: [
      { version: '1.8.3', date: '2026-03-10', changes: ['CVE-2026-1234 patch', 'Improved geo-IP accuracy'] },
      { version: '1.8.0', date: '2026-02-01', changes: ['AI-powered anomaly detection', 'SIEM export (JSON/CEF)'] },
      { version: '1.5.0', date: '2026-01-05', changes: ['Geo-blocking rules', 'Rate limit editor'] },
      { version: '1.0.0', date: '2025-12-10', changes: ['Initial release with basic WAF rules'] },
    ],
    reviews: [
      { id: 'r1', author: 'Henry W.', rating: 5, comment: 'Blocked 2000+ attack attempts in the first week. Absolutely essential.', date: '2026-03-15' },
      { id: 'r2', author: 'Iris N.', rating: 5, comment: 'The AI anomaly detection caught a zero-day attempt. Incredible.', date: '2026-03-05' },
    ],
  },
];

const CATEGORY_ICONS: Record<PluginCategory, React.ElementType> = {
  agents: Bot,
  apps: Puzzle,
  workflows: GitBranch,
  channels: MessageSquare,
  analytics: BarChart3,
  security: Shield,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={`h-4 w-4 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : i < rating ? 'fill-yellow-200 text-yellow-400' : 'text-muted-foreground'}`}
    />
  ));
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScreenshotsPlaceholder() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Screenshots are provided by the plugin author and will appear here once the plugin is published.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30"
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Screenshot {i}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VersionHistory({ history }: { history: Plugin['versionHistory'] }) {
  return (
    <div className="space-y-4">
      {history.map((entry, idx) => (
        <div key={entry.version} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${idx === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted'}`}>
              <History className="h-3.5 w-3.5" />
            </div>
            {idx < history.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="pb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">v{entry.version}</span>
              {idx === 0 && <Badge variant="secondary" className="text-xs">Latest</Badge>}
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {entry.changes.map((change) => (
                <li key={change} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsSection({ reviews, rating, reviewCount }: { reviews: Plugin['reviews']; rating: number; reviewCount: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-5xl font-bold">{rating.toFixed(1)}</div>
          <div className="mt-1 flex justify-center gap-0.5">{renderStars(rating)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{reviewCount} reviews</div>
        </div>
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = star >= Math.floor(rating) ? (star === 5 ? 65 : star === 4 ? 25 : 10) : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-2 text-right text-muted-foreground">{star}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      <Separator />
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {review.author[0]}
                </div>
                <span className="text-sm font-medium">{review.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">{renderStars(review.rating)}</div>
                <span className="text-xs text-muted-foreground">{review.date}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{review.comment}</p>
            <Separator className="mt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Install / Uninstall Dialog
// ---------------------------------------------------------------------------

function InstallDialog({
  plugin,
  open,
  onConfirm,
  onClose,
  loading,
}: {
  plugin: Plugin;
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{plugin.icon}</span>
            Install {plugin.name}?
          </DialogTitle>
          <DialogDescription>
            Review the permissions this plugin requires before installing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm font-medium">This plugin will be granted access to:</p>
          <ul className="space-y-2">
            {plugin.permissions.map((perm) => (
              <li key={perm} className="flex items-start gap-2 text-sm">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>{perm}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Only install plugins from trusted authors. Review permissions carefully before proceeding.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Installing…' : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UninstallDialog({
  plugin,
  open,
  onConfirm,
  onClose,
  loading,
}: {
  plugin: Plugin;
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{plugin.icon}</span>
            Uninstall {plugin.name}?
          </DialogTitle>
          <DialogDescription>
            This will remove the plugin and revoke all its permissions. Any data created by this plugin may be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Uninstalling…' : 'Uninstall Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PluginDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Attempt real API first, fall back to mock data
    fetch(`/api/proxy/ai/plugins/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data) => {
        if (data) {
          setPlugin(data);
        } else {
          const found = MOCK_PLUGINS.find((p) => p.slug === slug) ?? null;
          if (!found) setNotFound(true);
          setPlugin(found);
        }
        setLoading(false);
      });
  }, [slug]);

  function handleInstall() {
    setActionLoading(true);
    setTimeout(() => {
      setInstalled(true);
      setActionLoading(false);
      setShowInstallDialog(false);
      toast({ title: 'Plugin installed', description: `${plugin?.name} has been installed successfully.` });
    }, 1200);
  }

  function handleUninstall() {
    setActionLoading(true);
    setTimeout(() => {
      setInstalled(false);
      setActionLoading(false);
      setShowUninstallDialog(false);
      toast({ title: 'Plugin uninstalled', description: `${plugin?.name} has been removed.` });
    }, 1000);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !plugin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <Puzzle className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold">Plugin not found</h2>
        <p className="text-sm text-muted-foreground">No plugin with slug &quot;{slug}&quot; exists in the marketplace.</p>
        <Button variant="outline" onClick={() => router.push('/plugins')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>
      </div>
    );
  }

  const CategoryIcon = CATEGORY_ICONS[plugin.category];

  return (
    <>
      {/* Install / uninstall dialogs */}
      <InstallDialog
        plugin={plugin}
        open={showInstallDialog}
        onConfirm={handleInstall}
        onClose={() => setShowInstallDialog(false)}
        loading={actionLoading}
      />
      <UninstallDialog
        plugin={plugin}
        open={showUninstallDialog}
        onConfirm={handleUninstall}
        onClose={() => setShowUninstallDialog(false)}
        loading={actionLoading}
      />

      <div className="space-y-6">
        {/* Back nav */}
        <Link
          href="/plugins"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Plugin Marketplace
        </Link>

        {/* Hero */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-sm">
              {plugin.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{plugin.name}</h1>
                {installed && (
                  <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Installed
                  </Badge>
                )}
                {plugin.featured && (
                  <Badge variant="secondary">Featured</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                by {plugin.author} · v{plugin.version} · Updated {plugin.updatedAt}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  {renderStars(plugin.rating)}
                  <span className="ml-1 text-sm font-medium">{plugin.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">({plugin.reviewCount})</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Download className="h-3.5 w-3.5" />
                  {formatCount(plugin.installCount)} installs
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CategoryIcon className="h-3.5 w-3.5" />
                  <span className="capitalize">{plugin.category}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="flex shrink-0 gap-2">
            {installed ? (
              <Button variant="destructive" onClick={() => setShowUninstallDialog(true)}>
                Uninstall
              </Button>
            ) : (
              <Button onClick={() => setShowInstallDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                Install
              </Button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {plugin.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1">
              <Tag className="h-3 w-3" />
              {tag}
            </Badge>
          ))}
        </div>

        <Separator />

        {/* Main content tabs */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Tabs — 2/3 width */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
                <TabsTrigger value="versions">Version History</TabsTrigger>
                <TabsTrigger value="reviews">
                  Reviews
                  <Badge variant="secondary" className="ml-1.5 text-xs">
                    {plugin.reviewCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">About this plugin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{plugin.longDescription}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" />
                      Required Permissions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {plugin.permissions.map((perm) => (
                        <li key={perm} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <span>{perm}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="screenshots" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Screenshots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScreenshotsPlaceholder />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Version History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VersionHistory history={plugin.versionHistory} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ratings & Reviews</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReviewsSection reviews={plugin.reviews} rating={plugin.rating} reviewCount={plugin.reviewCount} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar — 1/3 width */}
          <div className="space-y-4">
            {/* Author info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Author</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {plugin.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{plugin.author}</p>
                    <p className="text-xs text-muted-foreground">{plugin.authorEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plugin details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Version</span>
                  <span className="ml-auto font-mono">{plugin.version}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Released</span>
                  <span className="ml-auto">{plugin.createdAt}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Updated</span>
                  <span className="ml-auto">{plugin.updatedAt}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Installs</span>
                  <span className="ml-auto">{plugin.installCount.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Category</span>
                  <span className="ml-auto capitalize">{plugin.category}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium text-foreground">Rating</span>
                  <span className="ml-auto">{plugin.rating.toFixed(1)} / 5.0</span>
                </div>
              </CardContent>
            </Card>

            {/* Install CTA repeated in sidebar */}
            {!installed ? (
              <Button className="w-full" onClick={() => setShowInstallDialog(true)}>
                <Download className="mr-2 h-4 w-4" />
                Install Plugin
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Plugin Installed
                </div>
                <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => setShowUninstallDialog(true)}>
                  Uninstall
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
