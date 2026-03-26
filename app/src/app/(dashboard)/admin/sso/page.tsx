'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Github,
  Loader2,
  LogIn,
  Shield,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';
import { UpgradeGate } from '@/components/upgrade-gate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SamlConfig {
  entityId: string;
  acsUrl: string;
  metadataXml: string;
  enabled: boolean;
}

interface GithubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  enabled: boolean;
}

interface OidcConfig {
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
}

interface SsoConfig {
  saml: SamlConfig;
  github: GithubOAuthConfig;
  oidc: OidcConfig;
  jitProvisioning: boolean;
}

interface SsoLoginEntry {
  id: string;
  provider: 'saml' | 'github' | 'oidc';
  email: string;
  name: string;
  success: boolean;
  timestamp: string;
  ip?: string;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SsoConfig = {
  saml: { entityId: '', acsUrl: '', metadataXml: '', enabled: false },
  github: { clientId: '', clientSecret: '', callbackUrl: '', enabled: false },
  oidc: { discoveryUrl: '', clientId: '', clientSecret: '', enabled: false },
  jitProvisioning: false,
};

// ---------------------------------------------------------------------------
// Helper: collapsible section
// ---------------------------------------------------------------------------

function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-4 pt-0">{children}</CardContent>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helper: test status badge
// ---------------------------------------------------------------------------

function TestBadge({ status }: { status: TestStatus }) {
  if (status === 'testing')
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Testing…
      </span>
    );
  if (status === 'ok')
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" /> Connection OK
      </span>
    );
  if (status === 'error')
    return (
      <span className="flex items-center gap-1 text-xs text-destructive">
        <XCircle className="h-3 w-3" /> Connection failed
      </span>
    );
  return null;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function SsoContent() {
  const [config, setConfig] = useState<SsoConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<SsoLoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<
    Record<'saml' | 'github' | 'oidc', TestStatus>
  >({ saml: 'idle', github: 'idle', oidc: 'idle' });

  const metadataFileRef = useRef<HTMLInputElement>(null);

  // Load config + history
  useEffect(() => {
    Promise.all([
      api
        .get<SsoConfig | { data: SsoConfig }>('/api/v1/admin/sso/config')
        .then((res) => {
          const data = (res as { data: SsoConfig }).data ?? (res as SsoConfig);
          if (data && typeof data === 'object' && 'saml' in data) {
            setConfig(data);
          }
        })
        .catch(() => {
          /* endpoint may not exist yet — keep defaults */
        }),
      api
        .get<SsoLoginEntry[] | { data: SsoLoginEntry[] }>(
          '/api/v1/admin/sso/history?limit=20',
        )
        .then((res) => {
          const data = Array.isArray(res)
            ? res
            : Array.isArray((res as { data: SsoLoginEntry[] }).data)
              ? (res as { data: SsoLoginEntry[] }).data
              : [];
          setHistory(data);
        })
        .catch(() => setHistory([])),
    ]).finally(() => setLoading(false));
  }, []);

  // Save
  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/api/v1/admin/sso/config', config);
      toast({ title: 'SSO configuration saved' });
    } catch (err) {
      toast({
        title: 'Failed to save',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  // Test connection
  async function handleTest(provider: 'saml' | 'github' | 'oidc') {
    setTestStatus((s) => ({ ...s, [provider]: 'testing' }));
    try {
      await api.post(`/api/v1/admin/sso/test/${provider}`, {});
      setTestStatus((s) => ({ ...s, [provider]: 'ok' }));
    } catch {
      setTestStatus((s) => ({ ...s, [provider]: 'error' }));
    }
  }

  // Metadata XML upload
  function handleMetadataUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setConfig((c) => ({ ...c, saml: { ...c.saml, metadataXml: text } }));
    };
    reader.readAsText(file);
  }

  // Metadata XML download
  function handleMetadataDownload() {
    const xml = config.saml.metadataXml;
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saml-metadata.xml';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading SSO configuration…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* SAML 2.0                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Section
        title="SAML 2.0"
        icon={<Shield className="h-4 w-4 text-primary" />}
      >
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <p className="text-sm font-medium">Enable SAML 2.0</p>
            <p className="text-xs text-muted-foreground">
              Okta, Azure AD, Google Workspace, OneLogin
            </p>
          </div>
          <Switch
            checked={config.saml.enabled}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, saml: { ...c.saml, enabled: v } }))
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="saml-entity-id">SP Entity ID</Label>
            <Input
              id="saml-entity-id"
              placeholder="https://your-domain.com/saml/metadata"
              value={config.saml.entityId}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  saml: { ...c.saml, entityId: e.target.value },
                }))
              }
              disabled={!config.saml.enabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="saml-acs-url">ACS URL</Label>
            <Input
              id="saml-acs-url"
              placeholder="https://your-domain.com/saml/callback"
              value={config.saml.acsUrl}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  saml: { ...c.saml, acsUrl: e.target.value },
                }))
              }
              disabled={!config.saml.enabled}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="saml-metadata">IdP Metadata XML</Label>
          <Textarea
            id="saml-metadata"
            rows={5}
            placeholder="Paste your Identity Provider metadata XML here…"
            value={config.saml.metadataXml}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                saml: { ...c.saml, metadataXml: e.target.value },
              }))
            }
            disabled={!config.saml.enabled}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!config.saml.enabled}
              onClick={() => metadataFileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload XML
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!config.saml.enabled || !config.saml.metadataXml}
              onClick={handleMetadataDownload}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Download XML
            </Button>
            <input
              ref={metadataFileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={handleMetadataUpload}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!config.saml.enabled || testStatus.saml === 'testing'}
            onClick={() => handleTest('saml')}
          >
            {testStatus.saml === 'testing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Test SAML Connection
          </Button>
          <TestBadge status={testStatus.saml} />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* GitHub OAuth                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section
        title="GitHub OAuth"
        icon={<Github className="h-4 w-4 text-primary" />}
        defaultOpen={false}
      >
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <p className="text-sm font-medium">Enable GitHub OAuth</p>
            <p className="text-xs text-muted-foreground">
              Allow login with GitHub accounts
            </p>
          </div>
          <Switch
            checked={config.github.enabled}
            onCheckedChange={(v) =>
              setConfig((c) => ({
                ...c,
                github: { ...c.github, enabled: v },
              }))
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gh-client-id">Client ID</Label>
            <Input
              id="gh-client-id"
              placeholder="Ov23liXXXXXXXXXX"
              value={config.github.clientId}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  github: { ...c.github, clientId: e.target.value },
                }))
              }
              disabled={!config.github.enabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-client-secret">Client Secret</Label>
            <Input
              id="gh-client-secret"
              type="password"
              placeholder="••••••••••••••••••••"
              value={config.github.clientSecret}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  github: { ...c.github, clientSecret: e.target.value },
                }))
              }
              disabled={!config.github.enabled}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gh-callback">Callback URL</Label>
          <Input
            id="gh-callback"
            placeholder="https://your-domain.com/auth/github/callback"
            value={config.github.callbackUrl}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                github: { ...c.github, callbackUrl: e.target.value },
              }))
            }
            disabled={!config.github.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Register this URL in your GitHub OAuth App settings.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!config.github.enabled || testStatus.github === 'testing'}
            onClick={() => handleTest('github')}
          >
            {testStatus.github === 'testing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Test GitHub Connection
          </Button>
          <TestBadge status={testStatus.github} />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* OIDC                                                                */}
      {/* ------------------------------------------------------------------ */}
      <Section
        title="OIDC Provider"
        icon={<Shield className="h-4 w-4 text-zinc-500" />}
        defaultOpen={false}
      >
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <p className="text-sm font-medium">Enable OIDC</p>
            <p className="text-xs text-muted-foreground">
              Keycloak, Auth0, Dex, or any OpenID Connect provider
            </p>
          </div>
          <Switch
            checked={config.oidc.enabled}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, oidc: { ...c.oidc, enabled: v } }))
            }
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oidc-discovery">Discovery URL</Label>
          <Input
            id="oidc-discovery"
            placeholder="https://accounts.google.com/.well-known/openid-configuration"
            value={config.oidc.discoveryUrl}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                oidc: { ...c.oidc, discoveryUrl: e.target.value },
              }))
            }
            disabled={!config.oidc.enabled}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="oidc-client-id">Client ID</Label>
            <Input
              id="oidc-client-id"
              placeholder="unicore-client"
              value={config.oidc.clientId}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  oidc: { ...c.oidc, clientId: e.target.value },
                }))
              }
              disabled={!config.oidc.enabled}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oidc-client-secret">Client Secret</Label>
            <Input
              id="oidc-client-secret"
              type="password"
              placeholder="••••••••••••••••••••"
              value={config.oidc.clientSecret}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  oidc: { ...c.oidc, clientSecret: e.target.value },
                }))
              }
              disabled={!config.oidc.enabled}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!config.oidc.enabled || testStatus.oidc === 'testing'}
            onClick={() => handleTest('oidc')}
          >
            {testStatus.oidc === 'testing' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            Test OIDC Connection
          </Button>
          <TestBadge status={testStatus.oidc} />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* JIT Provisioning                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardContent className="flex items-center justify-between py-5">
          <div>
            <p className="text-sm font-medium">JIT Provisioning</p>
            <p className="text-xs text-muted-foreground">
              Automatically create user accounts on first SSO login
            </p>
          </div>
          <Switch
            checked={config.jitProvisioning}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, jitProvisioning: v }))
            }
          />
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving…' : 'Save SSO Configuration'}
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Login history                                                       */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <LogIn className="h-4 w-4" />
            SSO Login History
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Last 20 logins
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No SSO login history yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {entry.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {entry.email}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.name || '—'}
                      </TableCell>
                      <TableCell>
                        {entry.success ? (
                          <Badge variant="default">Success</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.ip ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default function AdminSsoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Single Sign-On
          </h1>
          <p className="text-muted-foreground">
            Configure SAML 2.0, GitHub OAuth, and OIDC identity providers
          </p>
        </div>
      </div>

      <UpgradeGate
        feature="sso"
        featureTitle="Single Sign-On (SSO)"
        featureDescription="Connect your identity provider via SAML 2.0, OIDC, or GitHub OAuth. Enable one-click login with Google Workspace, Okta, Azure AD, and more."
      >
        <SsoContent />
      </UpgradeGate>
    </div>
  );
}
