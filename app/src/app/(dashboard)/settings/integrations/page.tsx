'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Hash,
  MessageSquare,
  CreditCard,
  Search,
  ShoppingBag,
  Share2,
  XCircle,
  Zap,
  Shield,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@bemindlabs/unicore-ui';
import type { IntegrationConfig } from '@bemindlabs/unicore-shared-types';
import { TelegramConfig } from '../../../../components/settings/TelegramConfig';
import { LineConfig } from '../../../../components/settings/LineConfig';
import { LineRichMenu } from '../../../../components/settings/LineRichMenu';
import { LineFlexTemplates } from '../../../../components/settings/LineFlexTemplates';
import { useLicense } from '@/hooks/use-license';

// ---------------------------------------------------------------------------
// Integration definitions
// ---------------------------------------------------------------------------

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  hint?: string;
}

interface IntegrationDef {
  provider: string;
  name: string;
  description: string;
  category: 'channels' | 'payments' | 'productivity' | 'e-commerce' | 'advertising';
  edition: 'community' | 'pro';
  docsUrl: string;
  fields: IntegrationField[];
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  // ── Channels (Social) ────────────────────────────────────────────────────
  {
    provider: 'telegram',
    name: 'Telegram',
    description: 'Bot messaging and group automation',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://core.telegram.org/bots/api',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF…', hint: 'Get from @BotFather' },
    ],
  },
  {
    provider: 'line',
    name: 'LINE',
    description: 'Official Account messaging and rich menus',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://developers.line.biz',
    fields: [
      { key: 'channelId', label: 'Channel ID', type: 'text', placeholder: '1234567890' },
      { key: 'channelSecret', label: 'Channel Secret', type: 'password' },
      { key: 'accessToken', label: 'Channel Access Token', type: 'password' },
    ],
  },
  {
    provider: 'whatsapp',
    name: 'WhatsApp',
    description: 'Business API for customer conversations',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text' },
      { key: 'accessToken', label: 'Permanent Access Token', type: 'password' },
      { key: 'verifyToken', label: 'Webhook Verify Token', type: 'text', hint: 'Your chosen verify string' },
    ],
  },
  {
    provider: 'facebook',
    name: 'Facebook Messenger',
    description: 'Page messaging and customer support',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    fields: [
      { key: 'pageId', label: 'Page ID', type: 'text' },
      { key: 'accessToken', label: 'Page Access Token', type: 'password' },
    ],
  },
  {
    provider: 'instagram',
    name: 'Instagram',
    description: 'Direct messages and story replies',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    fields: [
      { key: 'accountId', label: 'Instagram Business Account ID', type: 'text' },
      { key: 'accessToken', label: 'Access Token', type: 'password' },
    ],
  },
  {
    provider: 'tiktok',
    name: 'TikTok',
    description: 'Direct messages via TikTok for Developers',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://developers.tiktok.com',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', hint: 'For webhook signature verification' },
    ],
  },
  {
    provider: 'discord',
    name: 'Discord',
    description: 'Bot commands and server notifications',
    category: 'channels',
    edition: 'pro',
    docsUrl: 'https://discord.com/developers/docs',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password' },
      { key: 'applicationId', label: 'Application ID', type: 'text' },
    ],
  },
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Workspace notifications and agent interaction',
    category: 'channels',
    edition: 'community',
    docsUrl: 'https://api.slack.com',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'xoxb-…' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password' },
    ],
  },
  {
    provider: 'email',
    name: 'Email (SMTP)',
    description: 'Send and receive via custom mail server',
    category: 'channels',
    edition: 'community',
    docsUrl: 'https://nodemailer.com',
    fields: [
      { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.gmail.com' },
      { key: 'port', label: 'Port', type: 'text', placeholder: '587' },
      { key: 'user', label: 'Username', type: 'text' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
  },

  // ── Payments ─────────────────────────────────────────────────────────────
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Accept payments and sync financial data',
    category: 'payments',
    edition: 'community',
    docsUrl: 'https://stripe.com/docs',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_…' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_…', hint: 'Optional — for event verification' },
    ],
  },

  // ── Productivity ─────────────────────────────────────────────────────────
  {
    provider: 'google-workspace',
    name: 'Google Workspace',
    description: 'Calendar, Drive, and Gmail integration',
    category: 'productivity',
    edition: 'community',
    docsUrl: 'https://workspace.google.com',
    fields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password' },
    ],
  },

  // ── E-Commerce ───────────────────────────────────────────────────────────
  {
    provider: 'shopify',
    name: 'Shopify',
    description: 'Sync products, orders, and customers',
    category: 'e-commerce',
    edition: 'community',
    docsUrl: 'https://shopify.dev',
    fields: [
      { key: 'shopDomain', label: 'Shop Domain', type: 'text', placeholder: 'myshop.myshopify.com' },
      { key: 'adminApiKey', label: 'Admin API Access Token', type: 'password' },
    ],
  },

  // ── Advertising ──────────────────────────────────────────────────────────
  {
    provider: 'tiktok-ads',
    name: 'TikTok Ads',
    description: 'Sync campaigns, ad groups, and performance metrics',
    category: 'advertising',
    edition: 'community',
    docsUrl: 'https://business-api.tiktok.com',
    fields: [
      { key: 'accessToken', label: 'Marketing API Access Token', type: 'password' },
      { key: 'advertiserId', label: 'Advertiser ID', type: 'text' },
    ],
  },
  {
    provider: 'meta-ads',
    name: 'Meta Ads',
    description: 'Facebook and Instagram ad campaign data',
    category: 'advertising',
    edition: 'community',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password' },
      { key: 'adAccountId', label: 'Ad Account ID', type: 'text', placeholder: 'act_123…' },
    ],
  },
  {
    provider: 'google-ads',
    name: 'Google Ads',
    description: 'Search and display ad campaign syncing',
    category: 'advertising',
    edition: 'community',
    docsUrl: 'https://developers.google.com/google-ads/api',
    fields: [
      { key: 'developerToken', label: 'Developer Token', type: 'password' },
      { key: 'clientId', label: 'OAuth Client ID', type: 'text' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password' },
      { key: 'customerId', label: 'Customer ID', type: 'text', placeholder: '123-456-7890' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

interface CategoryMeta {
  label: string;
  icon: React.ElementType;
  description: string;
}

const CATEGORIES: Record<string, CategoryMeta> = {
  channels: { label: 'Channels', icon: MessageSquare, description: 'Messaging platforms for customer and team communication' },
  payments: { label: 'Payments', icon: CreditCard, description: 'Payment processing and financial data' },
  productivity: { label: 'Productivity', icon: Zap, description: 'Workspace and productivity tools' },
  'e-commerce': { label: 'E-Commerce', icon: ShoppingBag, description: 'Online store integrations' },
  advertising: { label: 'Advertising', icon: Share2, description: 'Ad platforms and campaign data' },
};

const CATEGORY_ORDER = ['channels', 'payments', 'advertising', 'productivity', 'e-commerce'] as const;

// Providers with dedicated config panels (shown in Channels tab instead of generic card)
const DEDICATED_PANELS = new Set(['telegram', 'line']);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type IntegrationState = IntegrationConfig & { isConfigured: boolean };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsIntegrationsPage() {
  const { isPro } = useLicense();
  const [integrations, setIntegrations] = useState<IntegrationState[]>(() =>
    INTEGRATION_DEFS.map((def) => ({
      name: def.name,
      provider: def.provider,
      enabled: false,
      isConfigured: false,
      config: {},
    })),
  );
  const [configTarget, setConfigTarget] = useState<IntegrationDef | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  // Count connected integrations per category
  const connectedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const def of INTEGRATION_DEFS) {
      const state = integrations.find((i) => i.provider === def.provider);
      if (state?.isConfigured) {
        counts[def.category] = (counts[def.category] ?? 0) + 1;
      }
    }
    return counts;
  }, [integrations]);

  const totalConnected = Object.values(connectedCounts).reduce((a, b) => a + b, 0);

  const filteredDefs = useMemo(() => {
    if (!search.trim()) return INTEGRATION_DEFS;
    const q = search.toLowerCase();
    return INTEGRATION_DEFS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.provider.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    );
  }, [search]);

  const openConfig = useCallback((def: IntegrationDef) => {
    // Pre-fill existing config values if reconnecting
    const existing = integrations.find((i) => i.provider === def.provider);
    setConfigTarget(def);
    setConfigValues(existing?.isConfigured ? { ...(existing.config as Record<string, string>) } : {});
  }, [integrations]);

  const handleConfigSave = useCallback(() => {
    if (!configTarget) return;
    setIntegrations((prev) =>
      prev.map((i) =>
        i.provider === configTarget.provider
          ? { ...i, enabled: true, isConfigured: true, config: configValues }
          : i,
      ),
    );
    toast({ title: 'Integration connected', description: `${configTarget.name} is now active.` });
    setConfigTarget(null);
    setConfigValues({});
  }, [configTarget, configValues]);

  const toggleEnabled = useCallback(
    (provider: string, enabled: boolean) => {
      setIntegrations((prev) =>
        prev.map((i) => {
          if (i.provider !== provider) return i;
          if (enabled && !i.isConfigured) {
            const def = INTEGRATION_DEFS.find((d) => d.provider === provider);
            if (def) openConfig(def);
            return i;
          }
          return { ...i, enabled };
        }),
      );
    },
    [openConfig],
  );

  const handleDisconnect = useCallback((provider: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.provider === provider ? { ...i, enabled: false, isConfigured: false, config: {} } : i,
      ),
    );
    const def = INTEGRATION_DEFS.find((d) => d.provider === provider);
    toast({ title: 'Disconnected', description: `${def?.name ?? provider} has been removed.` });
  }, []);

  // ── Render helpers ──────────────────────────────────────────────────────

  function renderIntegrationCard(def: IntegrationDef) {
    const state = integrations.find((i) => i.provider === def.provider);
    const isConfigured = state?.isConfigured ?? false;
    const isEnabled = state?.enabled ?? false;
    const needsPro = def.edition === 'pro' && !isPro;

    return (
      <div
        key={def.provider}
        className={`group relative flex items-center justify-between rounded-lg border p-4 transition-colors ${
          isConfigured
            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
            : 'hover:border-muted-foreground/25'
        }`}
      >
        {/* Left: info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{def.name}</span>
            {needsPro && (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-1.5 py-0">
                PRO
              </Badge>
            )}
            {isConfigured ? (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 text-muted-foreground">
                <XCircle className="h-3 w-3" />
                Not connected
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{def.description}</p>
        </div>

        {/* Right: actions */}
        <div className="ml-4 flex items-center gap-2 shrink-0">
          <a
            href={def.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Documentation"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {isConfigured ? (
            <>
              <Switch
                checked={isEnabled}
                onCheckedChange={(v) => toggleEnabled(def.provider, v)}
              />
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => openConfig(def)}>
                Edit
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleDisconnect(def.provider)}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={needsPro}
              onClick={() => openConfig(def)}
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    );
  }

  function renderCategorySection(category: string) {
    const meta = CATEGORIES[category];
    if (!meta) return null;
    const Icon = meta.icon;
    const defs = filteredDefs.filter((d) => d.category === category && !DEDICATED_PANELS.has(d.provider));
    if (defs.length === 0) return null;
    const connected = connectedCounts[category] ?? 0;

    return (
      <Card key={category}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{meta.label}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {connected}/{defs.length + (category === 'channels' ? DEDICATED_PANELS.size : 0)} connected
            </Badge>
          </div>
          <CardDescription className="text-xs">{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {defs.map(renderIntegrationCard)}
        </CardContent>
      </Card>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-sm text-muted-foreground">
              {INTEGRATION_DEFS.length} available &middot; {totalConnected} connected
            </p>
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Pro banner */}
      {!isPro && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <Shield className="h-4 w-4 shrink-0" />
          <span>
            Channel integrations (Telegram, LINE, WhatsApp, TikTok, and more) require a <strong>Pro license</strong>.
          </span>
          <a href="/settings/license" className="ml-auto shrink-0 underline font-medium hover:no-underline">
            Upgrade
          </a>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{filteredDefs.length}</Badge>
          </TabsTrigger>
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORIES[cat];
            const count = filteredDefs.filter((d) => d.category === cat).length;
            if (count === 0) return null;
            return (
              <TabsTrigger key={cat} value={cat}>
                {meta.label}
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* All tab */}
        <TabsContent value="all" className="space-y-6 mt-4">
          {/* Dedicated channel panels */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              {!isPro && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-1.5">PRO</Badge>
                </div>
              )}
              <TelegramConfig />
            </div>
            <div className="relative">
              {!isPro && (
                <div className="absolute top-3 right-3 z-10">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-1.5">PRO</Badge>
                </div>
              )}
              <LineConfig />
            </div>
          </div>

          {/* LINE extras */}
          <div className="grid gap-4 md:grid-cols-2">
            <LineRichMenu />
            <LineFlexTemplates />
          </div>

          {/* All categories */}
          {CATEGORY_ORDER.map(renderCategorySection)}
        </TabsContent>

        {/* Category tabs */}
        {CATEGORY_ORDER.map((cat) => (
          <TabsContent key={cat} value={cat} className="space-y-6 mt-4">
            {cat === 'channels' && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="relative">
                    {!isPro && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-1.5">PRO</Badge>
                      </div>
                    )}
                    <TelegramConfig />
                  </div>
                  <div className="relative">
                    {!isPro && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold px-1.5">PRO</Badge>
                      </div>
                    )}
                    <LineConfig />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <LineRichMenu />
                  <LineFlexTemplates />
                </div>
              </>
            )}
            {renderCategorySection(cat)}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Config Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!configTarget} onOpenChange={(open) => !open && setConfigTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Configure {configTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Credentials are encrypted with AES-256-GCM and never leave your server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {configTarget?.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`config-${field.key}`} className="text-xs font-medium">
                  {field.label}
                </Label>
                <Input
                  id={`config-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={configValues[field.key] ?? ''}
                  onChange={(e) =>
                    setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="font-mono text-sm"
                />
                {field.hint && (
                  <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfigTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfigSave}
              disabled={
                !configTarget ||
                configTarget.fields
                  .filter((f) => !f.hint?.toLowerCase().includes('optional'))
                  .some((f) => !configValues[f.key]?.trim())
              }
            >
              Save & Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
