'use client';

import { useCallback, useState } from 'react';
import { CheckCircle2, ExternalLink, Plug, XCircle } from 'lucide-react';
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
  toast,
} from '@unicore/ui';
import type { IntegrationConfig } from '@unicore/shared-types';
import { TelegramConfig } from '../../../../components/settings/TelegramConfig';
import { LineConfig } from '../../../../components/settings/LineConfig';

interface IntegrationDef {
  provider: string;
  name: string;
  description: string;
  category: string;
  docsUrl: string;
  fields: { key: string; label: string; type: 'text' | 'password'; placeholder?: string }[];
}

const INTEGRATION_DEFS: IntegrationDef[] = [
  {
    provider: 'line',
    name: 'LINE Messaging',
    description: 'Connect LINE Official Account for customer messaging',
    category: 'Messaging',
    docsUrl: 'https://developers.line.biz',
    fields: [
      { key: 'channelId', label: 'Channel ID', type: 'text', placeholder: '1234567890' },
      { key: 'channelSecret', label: 'Channel Secret', type: 'password' },
      { key: 'accessToken', label: 'Channel Access Token', type: 'password' },
    ],
  },
  {
    provider: 'facebook',
    name: 'Facebook Messenger',
    description: 'Connect Facebook Page for Messenger automation',
    category: 'Messaging',
    docsUrl: 'https://developers.facebook.com',
    fields: [
      { key: 'pageId', label: 'Page ID', type: 'text' },
      { key: 'accessToken', label: 'Page Access Token', type: 'password' },
    ],
  },
  {
    provider: 'stripe',
    name: 'Stripe',
    description: 'Accept payments and sync financial data',
    category: 'Payments',
    docsUrl: 'https://stripe.com/docs',
    fields: [
      { key: 'publishableKey', label: 'Publishable Key', type: 'text', placeholder: 'pk_live_…' },
      { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'sk_live_…' },
    ],
  },
  {
    provider: 'google-workspace',
    name: 'Google Workspace',
    description: 'Sync Calendar, Drive, and Gmail with agents',
    category: 'Productivity',
    docsUrl: 'https://workspace.google.com',
    fields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text' },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password' },
    ],
  },
  {
    provider: 'slack',
    name: 'Slack',
    description: 'Get notifications and interact with agents via Slack',
    category: 'Productivity',
    docsUrl: 'https://api.slack.com',
    fields: [
      { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: 'xoxb-…' },
      { key: 'signingSecret', label: 'Signing Secret', type: 'password' },
    ],
  },
  {
    provider: 'shopify',
    name: 'Shopify',
    description: 'Sync products, orders, and customers from Shopify',
    category: 'E-Commerce',
    docsUrl: 'https://shopify.dev',
    fields: [
      { key: 'shopDomain', label: 'Shop Domain', type: 'text', placeholder: 'myshop.myshopify.com' },
      { key: 'adminApiKey', label: 'Admin API Access Token', type: 'password' },
    ],
  },
];

type IntegrationState = IntegrationConfig & { isConfigured: boolean };

const DEFAULT_INTEGRATIONS: IntegrationState[] = INTEGRATION_DEFS.map((def) => ({
  name: def.name,
  provider: def.provider,
  enabled: false,
  isConfigured: false,
  config: {},
}));

const CATEGORY_ORDER = ['Messaging', 'Payments', 'Productivity', 'E-Commerce'];

export default function SettingsIntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationState[]>(DEFAULT_INTEGRATIONS);
  const [configTarget, setConfigTarget] = useState<IntegrationDef | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const toggleEnabled = useCallback((provider: string, enabled: boolean) => {
    setIntegrations((prev) =>
      prev.map((i) => {
        if (i.provider !== provider) return i;
        if (enabled && !i.isConfigured) {
          // open config dialog instead
          const def = INTEGRATION_DEFS.find((d) => d.provider === provider);
          if (def) {
            setConfigTarget(def);
            setConfigValues({});
          }
          return i;
        }
        return { ...i, enabled };
      }),
    );
  }, []);

  const handleConfigSave = useCallback(() => {
    if (!configTarget) return;
    setIntegrations((prev) =>
      prev.map((i) =>
        i.provider === configTarget.provider
          ? { ...i, enabled: true, isConfigured: true, config: configValues }
          : i,
      ),
    );
    toast({ title: 'Integration configured', description: `${configTarget.name} is now active.` });
    setConfigTarget(null);
    setConfigValues({});
  }, [configTarget, configValues]);

  const handleDisconnect = useCallback((provider: string) => {
    setIntegrations((prev) =>
      prev.map((i) =>
        i.provider === provider
          ? { ...i, enabled: false, isConfigured: false, config: {} }
          : i,
      ),
    );
    toast({ title: 'Disconnected' });
  }, []);

  const categories = CATEGORY_ORDER.filter((cat) =>
    INTEGRATION_DEFS.some((d) => d.category === cat),
  );

  return (
    <div className="space-y-6">
      {/* Telegram Bot — dedicated config panel */}
      <TelegramConfig />

      {/* LINE Messaging — dedicated config panel */}
      <LineConfig />

      {categories.map((category) => {
        const defs = INTEGRATION_DEFS.filter((d) => d.category === category);
        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plug className="h-5 w-5 text-primary" />
                <CardTitle>{category}</CardTitle>
              </div>
              <CardDescription>
                {defs.length} integration{defs.length !== 1 ? 's' : ''} available
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {defs.map((def) => {
                const state = integrations.find((i) => i.provider === def.provider);
                const isConfigured = state?.isConfigured ?? false;
                const isEnabled = state?.enabled ?? false;

                return (
                  <div
                    key={def.provider}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{def.name}</span>
                        {isConfigured ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <XCircle className="mr-1 h-3 w-3" />
                            Not connected
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{def.description}</p>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      <a
                        href={def.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {isConfigured ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(v) => toggleEnabled(def.provider, v)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(def.provider)}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfigTarget(def);
                            setConfigValues({});
                          }}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Config Dialog */}
      <Dialog open={!!configTarget} onOpenChange={(open) => !open && setConfigTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {configTarget?.name}</DialogTitle>
            <DialogDescription>
              Enter your API credentials. They are stored encrypted and never shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {configTarget?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`config-${field.key}`}>{field.label}</Label>
                <Input
                  id={`config-${field.key}`}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={configValues[field.key] ?? ''}
                  onChange={(e) =>
                    setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <Separator />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfigSave}
              disabled={
                !configTarget ||
                configTarget.fields.some((f) => !configValues[f.key]?.trim())
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
