'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Trash2,
  ArrowUpCircle,
  ToggleLeft,
  ToggleRight,
  Puzzle,
  Search,
  Package,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@unicore/ui';
import { api } from '@/lib/api';
import { PluginConfigForm } from '@/components/plugins/plugin-config-form';
import type { JsonSchema } from '@/components/plugins/plugin-config-form';

// Updated: 2026-03-23

type PluginStatus = 'active' | 'disabled' | 'error';

interface InstalledPlugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  latestVersion?: string;
  category: string;
  icon: string;
  status: PluginStatus;
  installedAt: string;
  updatedAt: string;
  errorMessage?: string;
  hasUpdate?: boolean;
  configSchema?: JsonSchema;
}

const MOCK_INSTALLED: InstalledPlugin[] = [
  {
    id: '1',
    slug: 'gpt-4o-agent',
    name: 'GPT-4o Agent',
    description: 'Deploy a powerful GPT-4o powered agent with advanced reasoning and multimodal capabilities.',
    author: 'OpenAI Labs',
    version: '2.1.0',
    latestVersion: '2.2.0',
    category: 'agents',
    icon: '🤖',
    status: 'active',
    installedAt: '2026-02-10T08:00:00Z',
    updatedAt: '2026-03-01T12:00:00Z',
    hasUpdate: true,
    configSchema: {
      title: 'GPT-4o Agent Configuration',
      description: 'Configure model parameters and behaviour.',
      properties: {
        apiKey: { type: 'string', title: 'API Key', format: 'password', description: 'Your OpenAI API key.' },
        model: { type: 'string', title: 'Model', enum: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'], default: 'gpt-4o' },
        maxTokens: { type: 'integer', title: 'Max Tokens', minimum: 256, maximum: 128000, default: 4096 },
        temperature: { type: 'number', title: 'Temperature', minimum: 0, maximum: 2, default: 0.7 },
        systemPrompt: { type: 'string', title: 'System Prompt', format: 'textarea', description: 'Optional system-level instruction.' },
        enableStreaming: { type: 'boolean', title: 'Enable Streaming', default: true },
        allowedTools: { type: 'array', title: 'Allowed Tools', items: { type: 'string' }, description: 'Tool names this agent may call.' },
      },
      required: ['apiKey'],
    },
  },
  {
    id: '2',
    slug: 'slack-integration',
    name: 'Slack Integration',
    description: 'Connect your workspace with Slack for real-time notifications, alerts, and two-way messaging.',
    author: 'UniCore Labs',
    version: '1.4.2',
    category: 'apps',
    icon: '💬',
    status: 'active',
    installedAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-03-10T14:00:00Z',
    configSchema: {
      title: 'Slack Integration',
      description: 'Connect UniCore to your Slack workspace.',
      properties: {
        botToken: { type: 'string', title: 'Bot Token', format: 'password', description: 'xoxb-… token from Slack App settings.' },
        defaultChannel: { type: 'string', title: 'Default Channel', description: 'Channel ID for notifications (e.g. C01234ABCD).' },
        notifyOnError: { type: 'boolean', title: 'Notify on Error', default: true },
        mentionGroup: { type: 'string', title: 'Mention Group', description: 'Group handle to @mention on alerts (optional).' },
      },
      required: ['botToken', 'defaultChannel'],
    },
  },
  {
    id: '3',
    slug: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'Deep dive into your business metrics with AI-powered insights and predictive analytics.',
    author: 'DataCore Inc.',
    version: '3.0.1',
    latestVersion: '3.1.0',
    category: 'analytics',
    icon: '📊',
    status: 'disabled',
    installedAt: '2026-02-05T11:00:00Z',
    updatedAt: '2026-02-28T09:00:00Z',
    hasUpdate: true,
    configSchema: {
      title: 'Advanced Analytics',
      properties: {
        retentionDays: { type: 'integer', title: 'Data Retention (days)', minimum: 7, maximum: 365, default: 90 },
        timezone: { type: 'string', title: 'Timezone', enum: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'], default: 'UTC' },
        enableAiInsights: { type: 'boolean', title: 'AI-Powered Insights', default: true },
      },
    },
  },
  {
    id: '4',
    slug: 'workflow-automation',
    name: 'Workflow Automation Pro',
    description: 'Build complex multi-step workflows with conditional logic, loops, and AI decision nodes.',
    author: 'FlowTech',
    version: '1.1.0',
    category: 'workflows',
    icon: '⚡',
    status: 'error',
    installedAt: '2026-03-01T10:00:00Z',
    updatedAt: '2026-03-15T08:00:00Z',
    errorMessage: 'Failed to connect to external workflow service. Check API credentials in configuration.',
    configSchema: {
      title: 'Workflow Automation Pro',
      description: 'Set API credentials for the external workflow service.',
      properties: {
        serviceUrl: { type: 'string', title: 'Service URL', description: 'Base URL of your workflow service.' },
        apiKey: { type: 'string', title: 'API Key', format: 'password' },
        timeoutSeconds: { type: 'integer', title: 'Timeout (seconds)', minimum: 5, maximum: 300, default: 30 },
        retryCount: { type: 'integer', title: 'Retry Count', minimum: 0, maximum: 5, default: 3 },
        webhookUrls: { type: 'array', title: 'Webhook URLs', items: { type: 'string' }, description: 'URLs to notify on workflow events.' },
      },
      required: ['serviceUrl', 'apiKey'],
    },
  },
  {
    id: '5',
    slug: 'telegram-channel',
    name: 'Telegram Channel',
    description: 'Deploy AI agents directly to Telegram with full message handling and inline buttons.',
    author: 'UniCore Labs',
    version: '2.3.1',
    category: 'channels',
    icon: '✈️',
    status: 'active',
    installedAt: '2026-01-15T07:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
    configSchema: {
      title: 'Telegram Channel',
      properties: {
        botToken: { type: 'string', title: 'Bot Token', format: 'password', description: 'Token from @BotFather.' },
        webhookSecret: { type: 'string', title: 'Webhook Secret', format: 'password', description: 'Optional secret for webhook validation.' },
        allowedChatIds: { type: 'array', title: 'Allowed Chat IDs', items: { type: 'string' }, description: 'Leave empty to allow all chats.' },
        parseMode: { type: 'string', title: 'Parse Mode', enum: ['HTML', 'Markdown', 'MarkdownV2'], default: 'HTML' },
      },
      required: ['botToken'],
    },
  },
  {
    id: '6',
    slug: 'security-scanner',
    name: 'Security Scanner',
    description: 'Automated vulnerability scanning and compliance checks for your AI agent configurations.',
    author: 'SecureAI',
    version: '1.0.3',
    category: 'security',
    icon: '🛡️',
    status: 'active',
    installedAt: '2026-02-22T13:00:00Z',
    updatedAt: '2026-03-05T16:00:00Z',
    configSchema: {
      title: 'Security Scanner',
      properties: {
        scanInterval: { type: 'string', title: 'Scan Interval', enum: ['hourly', 'daily', 'weekly'], default: 'daily' },
        severityThreshold: { type: 'string', title: 'Alert Threshold', enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
        notifyEmail: { type: 'string', title: 'Notification Email', description: 'Email for scan reports.' },
        autoRemediate: { type: 'boolean', title: 'Auto-Remediate', description: 'Automatically apply safe fixes.', default: false },
      },
    },
  },
];

function StatusBadge({ status }: { status: PluginStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Active
      </span>
    );
  }
  if (status === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <XCircle className="h-3.5 w-3.5" />
        Disabled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400">
      <AlertCircle className="h-3.5 w-3.5" />
      Error
    </span>
  );
}

function HealthDot({ status }: { status: PluginStatus }) {
  const color =
    status === 'active'
      ? 'bg-emerald-500'
      : status === 'error'
        ? 'bg-red-500'
        : 'bg-gray-400';
  return (
    <span className="relative flex h-2 w-2">
      {status === 'active' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

interface PluginRowProps {
  plugin: InstalledPlugin;
  onToggle: (id: string) => void;
  onUpdate: (id: string) => void;
  onUninstall: (plugin: InstalledPlugin) => void;
  onConfigure: (plugin: InstalledPlugin) => void;
  updatingId: string | null;
}

function PluginRow({ plugin, onToggle, onUpdate, onUninstall, onConfigure, updatingId }: PluginRowProps) {
  const isUpdating = updatingId === plugin.id;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors sm:flex-row sm:items-start sm:gap-4 ${
        plugin.status === 'error' ? 'border-red-200 dark:border-red-900/50' : ''
      }`}
    >
      {/* Icon + health */}
      <div className="relative flex-shrink-0 self-start">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
          {plugin.icon}
        </div>
        <span className="absolute -right-1 -top-1">
          <HealthDot status={plugin.status} />
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm">{plugin.name}</span>
          <StatusBadge status={plugin.status} />
          {plugin.hasUpdate && (
            <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-xs dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400">
              Update available
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>

        {plugin.status === 'error' && plugin.errorMessage && (
          <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            {plugin.errorMessage}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>v{plugin.version}</span>
          <span>by {plugin.author}</span>
          <span>Updated {new Date(plugin.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
        {/* Toggle enable/disable */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onToggle(plugin.id)}
          title={plugin.status === 'active' ? 'Disable plugin' : 'Enable plugin'}
        >
          {plugin.status === 'active' ? (
            <ToggleRight className="h-4 w-4 text-emerald-500" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          )}
          {plugin.status === 'active' ? 'Disable' : 'Enable'}
        </Button>

        {/* Configure */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onConfigure(plugin)}
        >
          <Settings className="h-3.5 w-3.5" />
          Configure
        </Button>

        {/* Update */}
        {plugin.hasUpdate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            onClick={() => onUpdate(plugin.id)}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUpCircle className="h-3.5 w-3.5" />
            )}
            {isUpdating ? 'Updating…' : `v${plugin.latestVersion}`}
          </Button>
        )}

        {/* Uninstall */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          onClick={() => onUninstall(plugin)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Uninstall
        </Button>
      </div>
    </div>
  );
}

export default function InstalledPluginsPage() {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PluginStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledPlugin | null>(null);
  const [configureTarget, setConfigureTarget] = useState<InstalledPlugin | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  const fetchInstalled = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<InstalledPlugin[]>('/api/proxy/ai/plugins/installed');
      setPlugins(data);
    } catch {
      setPlugins(MOCK_INSTALLED);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstalled();
  }, [fetchInstalled]);

  const handleToggle = useCallback(async (id: string) => {
    setPlugins(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const next: PluginStatus = p.status === 'active' ? 'disabled' : 'active';
        return { ...p, status: next };
      })
    );
    try {
      const target = plugins.find(p => p.id === id);
      if (!target) return;
      const action = target.status === 'active' ? 'disable' : 'enable';
      await api.post(`/api/proxy/ai/plugins/${id}/${action}`, {});
    } catch {
      // revert on failure
      setPlugins(prev =>
        prev.map(p => {
          if (p.id !== id) return p;
          const reverted: PluginStatus = p.status === 'active' ? 'disabled' : 'active';
          return { ...p, status: reverted };
        })
      );
    }
  }, [plugins]);

  const handleUpdate = useCallback(async (id: string) => {
    setUpdatingId(id);
    try {
      await api.post(`/api/proxy/ai/plugins/${id}/update`, {});
      setPlugins(prev =>
        prev.map(p => {
          if (p.id !== id) return p;
          return { ...p, version: p.latestVersion ?? p.version, hasUpdate: false, latestVersion: undefined };
        })
      );
    } catch {
      // silently ignore in demo
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const handleUninstall = useCallback(async () => {
    if (!uninstallTarget) return;
    setUninstalling(true);
    try {
      await api.delete(`/api/proxy/ai/plugins/${uninstallTarget.id}`);
      setPlugins(prev => prev.filter(p => p.id !== uninstallTarget.id));
    } catch {
      setPlugins(prev => prev.filter(p => p.id !== uninstallTarget.id));
    } finally {
      setUninstalling(false);
      setUninstallTarget(null);
    }
  }, [uninstallTarget]);

  const filtered = plugins.filter(p => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.author.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all: plugins.length,
    active: plugins.filter(p => p.status === 'active').length,
    disabled: plugins.filter(p => p.status === 'disabled').length,
    error: plugins.filter(p => p.status === 'error').length,
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/plugins">
            <Button variant="ghost" size="sm" className="mt-0.5 h-8 gap-1.5 text-xs text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Marketplace
            </Button>
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Package className="h-5 w-5 text-primary" />
              Installed Plugins
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage, configure, and monitor your installed plugins.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchInstalled}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            { label: 'Total', key: 'all', color: 'text-foreground' },
            { label: 'Active', key: 'active', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Disabled', key: 'disabled', color: 'text-muted-foreground' },
            { label: 'Error', key: 'error', color: 'text-red-500 dark:text-red-400' },
          ] as const
        ).map(stat => (
          <Card
            key={stat.key}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${statusFilter === stat.key ? 'border-primary/50 bg-primary/5' : ''}`}
            onClick={() => setStatusFilter(stat.key)}
          >
            <CardContent className="flex items-center justify-between p-3">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className={`text-xl font-bold ${stat.color}`}>{counts[stat.key]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search installed plugins…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Puzzle className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">No plugins found</p>
              <p className="text-sm text-muted-foreground/70">
                {plugins.length === 0 ? (
                  <>
                    You haven&apos;t installed any plugins yet.{' '}
                    <Link href="/plugins" className="text-primary hover:underline">
                      Browse the marketplace
                    </Link>
                    .
                  </>
                ) : (
                  'Try adjusting your search or filter.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(plugin => (
            <PluginRow
              key={plugin.id}
              plugin={plugin}
              onToggle={handleToggle}
              onUpdate={handleUpdate}
              onUninstall={setUninstallTarget}
              onConfigure={setConfigureTarget}
              updatingId={updatingId}
            />
          ))}
        </div>
      )}

      {/* Uninstall confirm dialog */}
      <Dialog open={!!uninstallTarget} onOpenChange={open => !open && setUninstallTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Uninstall Plugin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall{' '}
              <strong>{uninstallTarget?.name}</strong>? This action cannot be undone and will remove
              all plugin data and configurations.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUninstall}
              disabled={uninstalling}
              className="gap-1.5"
            >
              {uninstalling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {uninstalling ? 'Uninstalling…' : 'Uninstall'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configure dialog */}
      <Dialog open={!!configureTarget} onOpenChange={open => !open && setConfigureTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configure — {configureTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Plugin configuration UI for <strong>{configureTarget?.name}</strong> v{configureTarget?.version}.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-dashed bg-muted/30 py-10 text-center text-sm text-muted-foreground">
            Configuration schema coming soon.
          </div>
          <div className="flex justify-end pt-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
