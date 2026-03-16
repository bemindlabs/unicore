'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Progress,
  Separator,
  toast,
} from '@unicore/ui';
import type { LicenseInfo, LicenseStatus } from '@unicore/shared-types';
import { api } from '@/lib/api';

const MOCK_LICENSE: LicenseInfo = {
  key: 'COMM-XXXX-XXXX-XXXX',
  edition: 'community',
  status: 'active',
  maxAgents: 2,
  maxRoles: 3,
  expiresAt: '2099-12-31T23:59:59Z',
  features: {
    allAgents: false,
    customAgentBuilder: false,
    fullRbac: false,
    advancedWorkflows: false,
    allChannels: false,
    unlimitedRag: false,
    whiteLabelBranding: false,
    sso: false,
    auditLogs: false,
    prioritySupport: false,
  },
};

const PRO_FEATURES: LicenseInfo = {
  key: '',
  edition: 'pro',
  status: 'active',
  maxAgents: 50,
  maxRoles: 20,
  expiresAt: '',
  features: {
    allAgents: true,
    customAgentBuilder: true,
    fullRbac: true,
    advancedWorkflows: true,
    allChannels: true,
    unlimitedRag: true,
    whiteLabelBranding: true,
    sso: true,
    auditLogs: true,
    prioritySupport: true,
  },
};

const STATUS_CONFIG: Record<
  LicenseStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline'; icon: React.ComponentType<{ className?: string }> }
> = {
  active: { label: 'Active', variant: 'default', icon: CheckCircle2 },
  expired: { label: 'Expired', variant: 'outline', icon: AlertTriangle },
  revoked: { label: 'Revoked', variant: 'outline', icon: AlertTriangle },
  invalid: { label: 'Invalid', variant: 'outline', icon: AlertTriangle },
};

function FeatureRow({
  label,
  community,
  pro,
}: {
  label: string;
  community: boolean | number;
  pro: boolean | number;
}) {
  const renderValue = (v: boolean | number) => {
    if (typeof v === 'number') return <span className="font-medium">{v}</span>;
    return v ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  };

  return (
    <div className="grid grid-cols-3 items-center gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex justify-center">{renderValue(community)}</span>
      <span className="flex justify-center">{renderValue(pro)}</span>
    </div>
  );
}

export default function SettingsLicensePage() {
  const [license, setLicense] = useState<LicenseInfo>(MOCK_LICENSE);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradeKey, setUpgradeKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usersUsed, setUsersUsed] = useState(0);

  useEffect(() => {
    let mounted = true;

    interface LicenseStatusResponse {
      valid?: boolean;
      tier?: string;
      features?: string[] | Record<string, boolean>;
      expiresAt?: string | null;
      key?: string;
      edition?: string;
      status?: string;
      maxAgents?: number;
      maxRoles?: number;
    }

    Promise.all([
      api.get<LicenseStatusResponse>('/license/status'),
      api.get<{ count: number }>('/settings/team/count').catch(() => ({ count: 0 })),
    ])
      .then(([raw, teamData]) => {
        if (!mounted) return;

        // Map API response to LicenseInfo format
        const edition = raw.edition ?? raw.tier ?? 'community';
        const isPro = edition === 'pro';
        const featureObj: Record<string, boolean> = {};

        if (Array.isArray(raw.features)) {
          raw.features.forEach((f: string) => { featureObj[f] = true; });
          // Fill missing features as false
          for (const k of ['allAgents', 'customAgentBuilder', 'fullRbac', 'advancedWorkflows', 'allChannels', 'unlimitedRag', 'whiteLabelBranding', 'sso', 'auditLogs', 'prioritySupport']) {
            if (!(k in featureObj)) featureObj[k] = false;
          }
        } else if (raw.features && typeof raw.features === 'object') {
          Object.assign(featureObj, raw.features);
        } else {
          // Default community features
          for (const k of ['allAgents', 'customAgentBuilder', 'fullRbac', 'advancedWorkflows', 'allChannels', 'unlimitedRag', 'whiteLabelBranding', 'sso', 'auditLogs', 'prioritySupport']) {
            featureObj[k] = isPro;
          }
        }

        const mapped: LicenseInfo = {
          key: raw.key ?? (isPro ? 'PRO-XXXX-XXXX-XXXX' : 'COMM-XXXX-XXXX-XXXX'),
          edition: edition as LicenseInfo['edition'],
          status: (raw.status ?? (raw.valid !== false ? 'active' : 'invalid')) as LicenseStatus,
          maxAgents: raw.maxAgents ?? (isPro ? 50 : 2),
          maxRoles: raw.maxRoles ?? (isPro ? 20 : 3),
          expiresAt: raw.expiresAt ?? '2099-12-31T23:59:59Z',
          features: featureObj,
        };

        setLicense(mapped);
        setUsersUsed(teamData.count);
        setIsLoading(false);
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const statusCfg = STATUS_CONFIG[license.status];
  const StatusIcon = statusCfg.icon;

  const handleActivate = useCallback(async () => {
    if (!upgradeKey.trim()) return;
    setIsActivating(true);
    try {
      await api.post('/license/activate', { key: upgradeKey });
      toast({
        title: 'License activation',
        description: 'Key validated. Reload required to apply Pro features.',
      });
      setUpgradeKey('');
    } finally {
      setIsActivating(false);
    }
  }, [upgradeKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await api.post('/license/refresh');
      toast({ title: 'License refreshed', description: 'Status is up to date.' });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const daysUntilExpiry = (() => {
    const expiry = new Date(license.expiresAt);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const agentsUsed = 2;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading license...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <CardTitle>License Status</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <CardDescription>Your current edition and usage limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
              {license.edition === 'pro' ? (
                <Crown className="h-5 w-5 text-amber-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-primary" />
              )}
              <span className="font-semibold capitalize">{license.edition} Edition</span>
            </div>
            <Badge variant={statusCfg.variant} className="gap-1">
              <StatusIcon className="h-3.5 w-3.5" />
              {statusCfg.label}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">License Key</p>
              <p className="text-sm font-mono">{license.key}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Agents</p>
              <p className="text-sm font-medium">{license.maxAgents}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="text-sm font-medium">
                {license.expiresAt === '2099-12-31T23:59:59Z'
                  ? 'Never (Community)'
                  : `${new Date(license.expiresAt).toLocaleDateString()} (${daysUntilExpiry}d remaining)`}
              </p>
            </div>
          </div>

          <Separator />

          {/* Usage */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Resource Usage</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Team Members</span>
                  <span>
                    {usersUsed} / {license.maxRoles}
                  </span>
                </div>
                <Progress value={(usersUsed / license.maxRoles) * 100} className="h-2" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Active Agents</span>
                  <span>
                    {agentsUsed} / {license.maxAgents}
                  </span>
                </div>
                <Progress
                  value={(agentsUsed / license.maxAgents) * 100}
                  className="h-2"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>Edition Comparison</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Feature</span>
            <span className="text-center">Community</span>
            <span className="text-center">Pro</span>
          </div>
          {(
            [
              ['Max Agents', MOCK_LICENSE.maxAgents, PRO_FEATURES.maxAgents],
              ['Max Roles', MOCK_LICENSE.maxRoles, PRO_FEATURES.maxRoles],
              ['All Agents', MOCK_LICENSE.features.allAgents, PRO_FEATURES.features.allAgents],
              ['Advanced Workflows', MOCK_LICENSE.features.advancedWorkflows, PRO_FEATURES.features.advancedWorkflows],
              ['White Label', MOCK_LICENSE.features.whiteLabelBranding, PRO_FEATURES.features.whiteLabelBranding],
              ['SSO', MOCK_LICENSE.features.sso, PRO_FEATURES.features.sso],
              ['Priority Support', MOCK_LICENSE.features.prioritySupport, PRO_FEATURES.features.prioritySupport],
            ] as [string, boolean | number, boolean | number][]
          ).map(([label, community, pro]) => (
            <FeatureRow key={label} label={label} community={community} pro={pro} />
          ))}
        </CardContent>
      </Card>

      {/* Upgrade / activate */}
      {license.edition === 'community' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <CardTitle>Upgrade to Pro</CardTitle>
            </div>
            <CardDescription>
              Enter your Pro license key to unlock all 8 agents, 15 users, and advanced features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Get a license key</AlertTitle>
              <AlertDescription>
                Purchase a Pro license at{' '}
                <a
                  href="https://unicore.ai/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  unicore.ai/pricing
                </a>
                . Keys are validated against the UniCore license server.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="upgrade-key">License Key</Label>
                <Input
                  id="upgrade-key"
                  placeholder="PRO-XXXX-XXXX-XXXX"
                  value={upgradeKey}
                  onChange={(e) => setUpgradeKey(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleActivate}
                  disabled={isActivating || !upgradeKey.trim()}
                >
                  {isActivating ? 'Activating…' : 'Activate'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
