'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  ToggleLeft,
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
  Separator,
  Switch,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';

interface PlatformSettings {
  defaultPlan: TenantPlan;
  allowedPlans: TenantPlan[];
  defaultUserQuota: number;
  defaultStorageQuotaBytes: number;
  defaultApiCallQuotaPerDay: number;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  featureToggles: Record<string, boolean>;
  updatedAt: string;
  updatedBy: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gbToBytes(gb: number): number {
  return gb * 1024 ** 3;
}

function bytesToGb(bytes: number): number {
  return bytes / 1024 ** 3;
}

// ---------------------------------------------------------------------------
// Feature Toggle Row
// ---------------------------------------------------------------------------

function ToggleRow({
  featureKey,
  enabled,
  onToggle,
}: {
  featureKey: string;
  enabled: boolean;
  onToggle: (key: string, value: boolean) => void;
}) {
  const label = featureKey
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">{featureKey}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(v) => onToggle(featureKey, v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default quota section
// ---------------------------------------------------------------------------

interface QuotaForm {
  defaultUserQuota: string;
  defaultStorageQuotaGb: string;
  defaultApiCallQuotaPerDay: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ALL_PLANS: TenantPlan[] = ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local form state
  const [defaultPlan, setDefaultPlan] = useState<TenantPlan>('STARTER');
  const [allowedPlans, setAllowedPlans] = useState<TenantPlan[]>(['STARTER', 'GROWTH', 'ENTERPRISE']);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>({});
  const [quota, setQuota] = useState<QuotaForm>({
    defaultUserQuota: '5',
    defaultStorageQuotaGb: '5',
    defaultApiCallQuotaPerDay: '10000',
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.get<PlatformSettings>('/api/v1/admin/settings');
      setSettings(s);
      setDefaultPlan(s.defaultPlan);
      setAllowedPlans(s.allowedPlans);
      setMaintenanceMode(s.maintenanceMode);
      setRegistrationEnabled(s.registrationEnabled);
      setFeatureToggles(s.featureToggles ?? {});
      setQuota({
        defaultUserQuota: String(s.defaultUserQuota),
        defaultStorageQuotaGb: bytesToGb(s.defaultStorageQuotaBytes).toFixed(0),
        defaultApiCallQuotaPerDay: String(s.defaultApiCallQuotaPerDay),
      });
      setDirty(false);
    } catch (err) {
      toast({ title: 'Failed to load settings', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const markDirty = useCallback(() => setDirty(true), []);

  const handleFeatureToggle = useCallback((key: string, value: boolean) => {
    setFeatureToggles((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }, [markDirty]);

  const handlePlanToggle = useCallback((plan: TenantPlan) => {
    setAllowedPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );
    markDirty();
  }, [markDirty]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        defaultPlan,
        allowedPlans,
        maintenanceMode,
        registrationEnabled,
        featureToggles,
        defaultUserQuota: parseInt(quota.defaultUserQuota, 10) || 0,
        defaultStorageQuotaBytes: gbToBytes(parseFloat(quota.defaultStorageQuotaGb) || 0),
        defaultApiCallQuotaPerDay: parseInt(quota.defaultApiCallQuotaPerDay, 10) || 0,
      };
      const updated = await api.patch<PlatformSettings>('/api/v1/admin/settings', payload);
      setSettings(updated);
      setDirty(false);
      toast({ title: 'Settings saved' });
    } catch (err) {
      toast({ title: 'Failed to save settings', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [defaultPlan, allowedPlans, maintenanceMode, registrationEnabled, featureToggles, quota]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
            <p className="text-muted-foreground">
              Global defaults, quotas, and feature flags
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSettings} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {settings && (
        <p className="text-xs text-muted-foreground">
          Last updated {new Date(settings.updatedAt).toLocaleString()} by {settings.updatedBy}
        </p>
      )}

      {!settings && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Settings endpoint unavailable</AlertTitle>
          <AlertDescription>
            The enterprise admin settings API is not yet active. Changes will be saved when available.
          </AlertDescription>
        </Alert>
      )}

      {/* Maintenance mode warning */}
      {maintenanceMode && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Maintenance Mode Active</AlertTitle>
          <AlertDescription>
            All tenant access is currently blocked. Disable maintenance mode to restore normal operation.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Platform Controls
            </CardTitle>
            <CardDescription>Global on/off switches for the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Block all tenant access immediately</p>
              </div>
              <Switch
                checked={maintenanceMode}
                onCheckedChange={(v) => { setMaintenanceMode(v); markDirty(); }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">New Tenant Registration</p>
                <p className="text-xs text-muted-foreground">Allow new tenants to sign up</p>
              </div>
              <Switch
                checked={registrationEnabled}
                onCheckedChange={(v) => { setRegistrationEnabled(v); markDirty(); }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Default plan */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plans</CardTitle>
            <CardDescription>Default plan and which plans are available</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Plan for New Tenants</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLANS.map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => { setDefaultPlan(plan); markDirty(); }}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      defaultPlan === plan
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-muted'
                    }`}
                  >
                    {plan}
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Allowed Plans</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLANS.map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => handlePlanToggle(plan)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      allowedPlans.includes(plan)
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {allowedPlans.includes(plan) && <span>✓</span>}
                    {plan}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Toggle plans to enable/disable them for new tenants</p>
            </div>
          </CardContent>
        </Card>

        {/* Default quotas */}
        <Card>
          <CardHeader>
            <CardTitle>Default Resource Quotas</CardTitle>
            <CardDescription>Applied to new tenants without a specific plan override</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="q-users">Max Users</Label>
              <Input
                id="q-users"
                type="number"
                min={1}
                value={quota.defaultUserQuota}
                onChange={(e) => { setQuota((p) => ({ ...p, defaultUserQuota: e.target.value })); markDirty(); }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-storage">Storage Quota (GB)</Label>
              <Input
                id="q-storage"
                type="number"
                min={1}
                value={quota.defaultStorageQuotaGb}
                onChange={(e) => { setQuota((p) => ({ ...p, defaultStorageQuotaGb: e.target.value })); markDirty(); }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-api">API Calls / Day</Label>
              <Input
                id="q-api"
                type="number"
                min={100}
                step={1000}
                value={quota.defaultApiCallQuotaPerDay}
                onChange={(e) => { setQuota((p) => ({ ...p, defaultApiCallQuotaPerDay: e.target.value })); markDirty(); }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Feature toggles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4" />
              Feature Toggles
            </CardTitle>
            <CardDescription>
              Enable or disable platform features globally
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(featureToggles).length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No feature toggles configured. Add toggles via the API.
              </div>
            ) : (
              Object.entries(featureToggles).map(([key, value]) => (
                <ToggleRow
                  key={key}
                  featureKey={key}
                  enabled={value}
                  onToggle={handleFeatureToggle}
                />
              ))
            )}

            {/* Common platform feature toggles (shown even if API has none) */}
            {Object.keys(featureToggles).length === 0 && (
              <div className="space-y-3 pt-2">
                {[
                  'enable_sso',
                  'enable_white_label',
                  'enable_advanced_workflows',
                  'enable_all_channels',
                  'enable_custom_domains',
                  'enable_advanced_analytics',
                ].map((key) => (
                  <ToggleRow
                    key={key}
                    featureKey={key}
                    enabled={featureToggles[key] ?? false}
                    onToggle={handleFeatureToggle}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Save bar (sticky) */}
      {dirty && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Unsaved changes</Badge>
            <span className="text-sm text-muted-foreground">Review your changes before saving</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSettings}>Discard</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
