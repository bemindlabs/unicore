'use client';

import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { DemoGuard } from '@/components/demo/DemoGuard';
import {
  AlertTriangle,
  ArrowDownCircle,
  Building2,
  CheckCircle2,
  Crown,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  XCircle,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Progress,
  Separator,
  Switch,
  toast,
} from '@unicore/ui';
import type { LicenseInfo, LicenseStatus } from '@unicore/shared-types';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useLicense } from '@/hooks/use-license';

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
    auditLogs: true,
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
    whiteLabelBranding: false,
    sso: true,
    auditLogs: true,
    prioritySupport: true,
  },
};

const ENTERPRISE_FEATURES: LicenseInfo = {
  key: '',
  edition: 'enterprise',
  status: 'active',
  maxAgents: 999,
  maxRoles: 999,
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

const MONTHLY_PRICE = 99;
const ANNUAL_PRICE = 990;
const ANNUAL_SAVINGS = Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100);

function FeatureRow({
  label,
  community,
  pro,
  enterprise,
}: {
  label: string;
  community: boolean | number | string;
  pro: boolean | number | string;
  enterprise: boolean | number | string;
}) {
  const renderValue = (v: boolean | number | string) => {
    if (typeof v === 'string') return <span className="font-medium text-xs">{v}</span>;
    if (typeof v === 'number') return <span className="font-medium">{v}</span>;
    return v ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : (
      <span className="text-muted-foreground">--</span>
    );
  };

  return (
    <div className="grid grid-cols-4 items-center gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex justify-center">{renderValue(community)}</span>
      <span className="flex justify-center">{renderValue(pro)}</span>
      <span className="flex justify-center">{renderValue(enterprise)}</span>
    </div>
  );
}

function BillingToggle({
  isAnnual,
  onToggle,
}: {
  isAnnual: boolean;
  onToggle: (annual: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
        Monthly
      </span>
      <Switch
        checked={isAnnual}
        onCheckedChange={onToggle}
      />
      <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
        Annual
      </span>
      {isAnnual && (
        <Badge variant="secondary" className="text-xs">
          Save {ANNUAL_SAVINGS}%
        </Badge>
      )}
    </div>
  );
}

export default function SettingsLicensePage() {
  const demoMode = useDemoMode();
  const [license, setLicense] = useState<LicenseInfo>(MOCK_LICENSE);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradeKey, setUpgradeKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usersUsed, setUsersUsed] = useState(0);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [_downgradeConfirmText, setDowngradeConfirmText] = useState('');

  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { isPolling, upgradeDetected } = useLicense({ pollOnUpgrade: true });

  const isCancelled = searchParams.get('cancelled') === 'true';

  useEffect(() => {
    let mounted = true;

    interface LicenseStatusResponse {
      valid?: boolean;
      edition?: string;
      /** @deprecated Use edition instead. */
      tier?: string;
      features?: string[] | Record<string, boolean>;
      expiresAt?: string | null;
      key?: string;
      status?: string;
      maxAgents?: number;
      maxRoles?: number;
      machineId?: string;
    }

    Promise.all([
      api.get<LicenseStatusResponse>('/api/v1/license/status'),
      api.get<{ count: number }>('/api/v1/settings/team/count').catch(() => ({ count: 0 })),
    ])
      .then(([raw, teamData]) => {
        if (!mounted) return;

        // Map API response to LicenseInfo format
        const edition = raw.edition ?? raw.tier ?? 'community';
        const isPro = edition === 'pro';
        const isEnt = edition === 'enterprise';
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
            featureObj[k] = isPro || isEnt;
          }
        }

        const mapped: LicenseInfo = {
          key: raw.key ?? (isEnt ? 'ENT-XXXX-XXXX-XXXX' : isPro ? 'PRO-XXXX-XXXX-XXXX' : 'COMM-XXXX-XXXX-XXXX'),
          edition: edition as LicenseInfo['edition'],
          status: (raw.status ?? (raw.valid !== false ? 'active' : 'invalid')) as LicenseStatus,
          maxAgents: raw.maxAgents ?? (isEnt ? 999 : isPro ? 50 : 2),
          maxRoles: raw.maxRoles ?? (isEnt ? 999 : isPro ? 20 : 3),
          expiresAt: raw.expiresAt ?? '2099-12-31T23:59:59Z',
          features: featureObj as unknown as LicenseInfo['features'],
        };

        setLicense(mapped);
        setUsersUsed(teamData.count);
        if (raw.machineId) setMachineId(raw.machineId);
        setIsLoading(false);
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const statusCfg = STATUS_CONFIG[license.status];
  const StatusIcon = statusCfg.icon;
  const isEnterprise = license.edition === 'enterprise';

  const handleActivate = useCallback(async () => {
    if (!upgradeKey.trim()) return;
    setIsActivating(true);
    setKeyError('');
    try {
      await api.post('/api/v1/license/activate', { key: upgradeKey });
      toast({
        title: 'License activation',
        description: 'Key validated. Reload required to apply features.',
      });
      setUpgradeKey('');
    } catch (err: any) {
      setKeyError(err?.message ?? 'Invalid key. Please check and try again.');
    } finally {
      setIsActivating(false);
    }
  }, [upgradeKey]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await api.post('/api/v1/license/revalidate');
      toast({ title: 'License refreshed', description: 'Status is up to date.' });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleUpgradeNow = useCallback(async () => {
    setIsUpgrading(true);
    try {
      const res = await api.post<{ url: string; sessionId: string }>('/api/v1/license/upgrade', {
        plan: isAnnual ? 'PRO_ANNUAL' : 'PRO_MONTHLY',
        email: user?.email ?? '',
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast({
        title: 'Upgrade failed',
        description: err?.message ?? 'Could not initiate upgrade. Please try again.',
      });
      setIsUpgrading(false);
    }
  }, [isAnnual, user?.email]);

  const handleDowngrade = useCallback(async () => {
    setDowngrading(true);
    try {
      const res = await api.post<{ effectiveDate?: string }>('/api/v1/license/downgrade', {
        email: user?.email ?? '',
      });
      setShowDowngrade(false);
      setDowngradeConfirmText('');
      toast({
        title: 'Downgrade confirmed',
        description: res.effectiveDate
          ? `Your plan will switch to Community on ${new Date(res.effectiveDate).toLocaleDateString()}. Pro features remain active until then.`
          : 'Your plan will switch to Community at the end of the current billing period.',
      });
    } catch (err: any) {
      toast({
        title: 'Downgrade failed',
        description: err?.message ?? 'Could not process downgrade. Please try again or contact support.',
      });
    } finally {
      setDowngrading(false);
    }
  }, [user?.email]);

  const daysUntilExpiry = (() => {
    const expiry = new Date(license.expiresAt);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const agentsUsed = 2;

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading license...</div>;
  }

  if (demoMode) {
    return <DemoGuard />;
  }

  return (
    <div className="space-y-6">
      {/* UPG-5: Upgrade activation polling banner */}
      {isPolling && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          <AlertTitle>Activating your license...</AlertTitle>
          <AlertDescription>
            We are verifying your payment and activating features. This usually takes a few seconds.
          </AlertDescription>
        </Alert>
      )}

      {/* UPG-5: Upgrade success banner */}
      {upgradeDetected && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>Pro activated!</AlertTitle>
          <AlertDescription>
            All features are now unlocked. Refresh the page to see your updated limits and capabilities.
          </AlertDescription>
        </Alert>
      )}

      {/* UPG-5: Cancelled banner */}
      {isCancelled && (
        <Alert className="border-orange-500/50 bg-orange-500/10">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertTitle>Upgrade cancelled</AlertTitle>
          <AlertDescription>
            You can try again anytime. Your Community edition remains fully functional.
          </AlertDescription>
        </Alert>
      )}

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
              {isEnterprise ? (
                <Building2 className="h-5 w-5 text-violet-500" />
              ) : license.edition === 'pro' ? (
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
              <p className="text-xs text-muted-foreground">Custom Agent Slots</p>
              <p className="text-sm font-medium">
                {isEnterprise ? 'Unlimited' : `${license.maxAgents} (+ 8 built-in)`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="text-sm font-medium">
                {license.expiresAt === '2099-12-31T23:59:59Z'
                  ? 'Never (Community)'
                  : `${new Date(license.expiresAt).toLocaleDateString()} (${daysUntilExpiry}d remaining)`}
              </p>
            </div>
            {machineId && (
              <div>
                <p className="text-xs text-muted-foreground">Machine ID</p>
                <p className="text-sm font-mono truncate" title={machineId}>{machineId}</p>
              </div>
            )}
          </div>

          {/* Plan management links */}
          {license.edition !== 'community' && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://unicore.bemind.tech/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Change Plan
                </a>
                <span className="text-muted-foreground">·</span>
                <a
                  href="https://unicore.bemind.tech/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Manage Subscription
                </a>
              </div>
            </>
          )}

          <Separator />

          {/* Usage */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Resource Usage</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Team Members</span>
                  <span>
                    {usersUsed} / {isEnterprise ? '∞' : license.maxRoles}
                  </span>
                </div>
                <Progress value={isEnterprise ? 0 : (usersUsed / license.maxRoles) * 100} className="h-2" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Active Agents</span>
                  <span>
                    {agentsUsed} / {isEnterprise ? '∞' : license.maxAgents}
                  </span>
                </div>
                <Progress
                  value={isEnterprise ? 0 : (agentsUsed / license.maxAgents) * 100}
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
          <div className="grid grid-cols-4 gap-4 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Feature</span>
            <span className="text-center">Community</span>
            <span className="text-center">Pro</span>
            <span className="text-center">Enterprise</span>
          </div>
          {(
            [
              ['Max Agents', MOCK_LICENSE.maxAgents, PRO_FEATURES.maxAgents, 'Unlimited'],
              ['Max Roles', MOCK_LICENSE.maxRoles, PRO_FEATURES.maxRoles, 'Unlimited'],
              ['All Agents', MOCK_LICENSE.features.allAgents, PRO_FEATURES.features.allAgents, ENTERPRISE_FEATURES.features.allAgents],
              ['Advanced Workflows', MOCK_LICENSE.features.advancedWorkflows, PRO_FEATURES.features.advancedWorkflows, ENTERPRISE_FEATURES.features.advancedWorkflows],
              ['White Label', MOCK_LICENSE.features.whiteLabelBranding, PRO_FEATURES.features.whiteLabelBranding, ENTERPRISE_FEATURES.features.whiteLabelBranding],
              ['Audit Logs', MOCK_LICENSE.features.auditLogs, PRO_FEATURES.features.auditLogs, ENTERPRISE_FEATURES.features.auditLogs],
              ['SSO', MOCK_LICENSE.features.sso, PRO_FEATURES.features.sso, ENTERPRISE_FEATURES.features.sso],
              ['Priority Support', MOCK_LICENSE.features.prioritySupport, PRO_FEATURES.features.prioritySupport, ENTERPRISE_FEATURES.features.prioritySupport],
              ['Multi-tenancy', false, false, true],
              ['HA Cluster', false, false, true],
              ['Compliance Controls', false, false, true],
              ['Dedicated Account Mgr', false, false, true],
            ] as [string, boolean | number | string, boolean | number | string, boolean | number | string][]
          ).map(([label, community, pro, enterprise]) => (
            <FeatureRow key={label} label={label} community={community} pro={pro} enterprise={enterprise} />
          ))}
        </CardContent>
      </Card>

      {/* UPG-3: One-click upgrade + manual key activation */}
      {license.edition === 'community' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <CardTitle>Upgrade to Pro</CardTitle>
            </div>
            <CardDescription>
              Unlock all 50 agents, 20 roles, advanced workflows, and premium features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* One-click upgrade section */}
            <div className="rounded-lg border bg-card p-6 space-y-5">
              <BillingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />

              <div className="text-center space-y-1">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    ${isAnnual ? ANNUAL_PRICE : MONTHLY_PRICE}
                  </span>
                  <span className="text-muted-foreground">
                    /{isAnnual ? 'year' : 'month'}
                  </span>
                </div>
                {isAnnual && (
                  <p className="text-sm text-muted-foreground">
                    ${Math.round(ANNUAL_PRICE / 12)}/mo billed annually (save {ANNUAL_SAVINGS}%)
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Upgrading as <span className="font-medium text-foreground">{user?.email}</span>
                </div>
                <Button
                  size="lg"
                  className="w-full max-w-xs gap-2"
                  onClick={handleUpgradeNow}
                  disabled={isUpgrading}
                >
                  {isUpgrading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting to checkout...
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4" />
                      Upgrade Now
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Secure checkout via Stripe. Cancel anytime.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or activate with a key</span>
              </div>
            </div>

            {/* Manual key activation */}
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Have a license key?</AlertTitle>
              <AlertDescription>
                Enter your license key below. Keys are validated against the UniCore license server.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="upgrade-key">License Key</Label>
                <Input
                  id="upgrade-key"
                  placeholder="PRO-XXXX-XXXX-XXXX"
                  value={upgradeKey}
                  onChange={(e) => { setUpgradeKey(e.target.value); setKeyError(''); }}
                />
                {keyError && <p className="text-xs text-destructive">{keyError}</p>}
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleActivate}
                  disabled={isActivating || !upgradeKey.trim()}
                  variant="outline"
                >
                  {isActivating ? 'Activating...' : 'Activate'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enterprise upsell card for Community and Pro users */}
      {!isEnterprise && (
        <Card className="border-violet-200 dark:border-violet-900/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-violet-500" />
              <CardTitle>Need Enterprise?</CardTitle>
            </div>
            <CardDescription>
              Multi-tenancy, HA clustering, compliance controls, SCIM SSO, and a dedicated account manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href="https://unicore.bemind.tech/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300 dark:hover:bg-violet-900/40"
            >
              <Building2 className="h-4 w-4" />
              Contact Sales
            </a>
          </CardContent>
        </Card>
      )}

      {/* UNC-478: Downgrade option for Pro users */}
      {license.edition === 'pro' && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
            onClick={() => setShowDowngrade(true)}
          >
            <ArrowDownCircle className="mr-1 inline h-3.5 w-3.5" />
            Downgrade to Community
          </button>
        </div>
      )}

      {/* UNC-478: Downgrade confirmation dialog */}
      <Dialog open={showDowngrade} onOpenChange={setShowDowngrade}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Downgrade to Community?</DialogTitle>
            <DialogDescription>
              Your Pro subscription will be cancelled at the end of the current billing period.
              You will lose access to the following features:
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 py-2 text-sm">
            {[
              ['All Pro agents', 'Limited to 2 custom agents'],
              ['Advanced workflows', 'Basic workflows only'],
              ['All channels', 'Slack + Email only'],
              ['Full RBAC', 'Basic roles only (3 max)'],
              ['SSO integration', 'Standard login only'],
              ['Priority support', 'Community support only'],
            ].map(([feature, fallback]) => (
              <li key={feature} className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <span className="font-medium">{feature}</span>
                  <span className="text-muted-foreground"> — {fallback}</span>
                </div>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDowngrade}
              disabled={downgrading}
            >
              {downgrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm Downgrade'
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setShowDowngrade(false)}
              disabled={downgrading}
            >
              Keep Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
