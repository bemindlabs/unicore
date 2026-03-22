'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Globe,
  HardDrive,
  KeyRound,
  Trash2,
  Users,
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
  Label,
  Progress,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@unicore/ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED' | 'ARCHIVED';
type TenantPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  displayName?: string;
  customDomain?: string;
  plan: TenantPlan;
  status: TenantStatus;
  ownerEmail: string;
  memberCount: number;
  storageUsageBytes: number;
  apiCallsThisMonth: number;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  suspendReason?: string;
}

interface ImpersonationToken {
  token: string;
  tenantId: string;
  expiresAt: string;
  issuedBy: string;
}

interface ResourceQuota {
  label: string;
  used: number;
  max: number;
  unit: string;
  formatValue: (v: number) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const PLAN_QUOTAS: Record<TenantPlan, { storage: number; apiPerDay: number; users: number }> = {
  STARTER: { storage: 5 * 1024 ** 3, apiPerDay: 10_000, users: 5 },
  GROWTH: { storage: 50 * 1024 ** 3, apiPerDay: 100_000, users: 25 },
  ENTERPRISE: { storage: 500 * 1024 ** 3, apiPerDay: 1_000_000, users: 200 },
  CUSTOM: { storage: 1024 ** 4, apiPerDay: 10_000_000, users: 1000 },
};

const STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  SUSPENDED: 'bg-red-100 text-red-800 border-red-300',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  DELETED: 'bg-gray-100 text-gray-600 border-gray-300',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-300',
};

// ---------------------------------------------------------------------------
// Quota Gauge
// ---------------------------------------------------------------------------

function QuotaGauge({ label, used, max, formatValue }: ResourceQuota) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const color = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className={`font-medium ${color}`}>
          {formatValue(used)} / {formatValue(max)}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% used</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impersonation Dialog
// ---------------------------------------------------------------------------

interface ImpersonateDialogProps {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ImpersonateDialog({ tenant, open, onOpenChange }: ImpersonateDialogProps) {
  const [token, setToken] = useState<ImpersonationToken | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImpersonate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.post<ImpersonationToken>(
        `/api/v1/admin/tenants/${tenant.id}/impersonate`,
        { durationMinutes: 60 },
      );
      setToken(result);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    if (!open) setToken(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Impersonate Tenant</DialogTitle>
          <DialogDescription>
            Generate a temporary admin access token for <strong>{tenant.name}</strong>. Valid for 60 minutes.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-3 py-2">
            <Alert>
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Impersonation Token Generated</AlertTitle>
              <AlertDescription className="mt-2">
                <code className="block break-all rounded bg-muted p-2 text-xs">{token.token}</code>
                <p className="mt-2 text-xs text-muted-foreground">
                  Expires: {new Date(token.expiresAt).toLocaleString()}
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="py-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Caution</AlertTitle>
              <AlertDescription>
                This token grants full access to the tenant account. All actions will be logged.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {token ? 'Close' : 'Cancel'}
          </Button>
          {!token && (
            <Button onClick={handleImpersonate} disabled={loading}>
              {loading ? 'Generating…' : 'Generate Token'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

function DeleteDialog({ tenant, open, onOpenChange, onDeleted }: DeleteDialogProps) {
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) setConfirm('');
  }, [open]);

  const handleDelete = useCallback(async () => {
    if (confirm !== tenant.slug) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/tenants/${tenant.id}`);
      toast({ title: `Tenant "${tenant.name}" deleted` });
      onDeleted();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }, [tenant, confirm, onDeleted]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Tenant</DialogTitle>
          <DialogDescription>
            This permanently deletes <strong>{tenant.name}</strong> and all its data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Type <strong>{tenant.slug}</strong> to confirm</Label>
          <input
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tenant.slug}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirm !== tenant.slug || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    api
      .get<Tenant>(`/api/v1/admin/tenants/${params.id}`)
      .then(setTenant)
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSuspend = useCallback(async () => {
    if (!tenant || !suspendReason.trim()) return;
    setSaving(true);
    try {
      const updated = await api.post<Tenant>(`/api/v1/admin/tenants/${tenant.id}/suspend`, {
        reason: suspendReason.trim(),
      });
      setTenant(updated);
      setShowSuspend(false);
      setSuspendReason('');
      toast({ title: 'Tenant suspended' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant, suspendReason]);

  const handleActivate = useCallback(async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const updated = await api.post<Tenant>(`/api/v1/admin/tenants/${tenant.id}/activate`, {});
      setTenant(updated);
      toast({ title: 'Tenant reactivated' });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        Loading tenant…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <Link href="/platform-admin/tenants" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Tenant not found or the GET /tenants/:id endpoint is not yet available.
          </CardContent>
        </Card>
      </div>
    );
  }

  const quotas = PLAN_QUOTAS[tenant.plan];
  const resourceQuotas: ResourceQuota[] = [
    {
      label: 'Storage',
      used: tenant.storageUsageBytes,
      max: quotas.storage,
      unit: 'bytes',
      formatValue: formatBytes,
    },
    {
      label: 'API Calls / Month',
      used: tenant.apiCallsThisMonth,
      max: quotas.apiPerDay * 30,
      unit: 'calls',
      formatValue: (v) => v.toLocaleString(),
    },
    {
      label: 'Members',
      used: tenant.memberCount,
      max: quotas.users,
      unit: 'users',
      formatValue: (v) => String(v),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/platform-admin/tenants" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {tenant.displayName ?? tenant.name}
            </h1>
            <p className="text-sm text-muted-foreground">{tenant.slug}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[tenant.status]}`}>
            {tenant.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImpersonate(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Impersonate
          </Button>
          {tenant.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowSuspend(true)}
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend
            </Button>
          )}
          {tenant.status === 'SUSPENDED' && (
            <Button size="sm" onClick={handleActivate} disabled={saving}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {saving ? 'Reactivating…' : 'Reactivate'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Suspension notice */}
      {tenant.status === 'SUSPENDED' && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertTitle>Tenant Suspended</AlertTitle>
          <AlertDescription>
            {tenant.suspendReason ?? 'No reason provided.'}
            {tenant.suspendedAt && (
              <span className="ml-2 text-xs opacity-70">
                Since {new Date(tenant.suspendedAt).toLocaleDateString()}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="quotas">Resource Quotas</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Config tab */}
        <TabsContent value="config" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Tenant ID', value: tenant.id },
                  { label: 'Slug', value: tenant.slug },
                  { label: 'Display Name', value: tenant.displayName ?? '—' },
                  { label: 'Owner Email', value: tenant.ownerEmail },
                  { label: 'Plan', value: tenant.plan },
                  { label: 'Status', value: tenant.status },
                  { label: 'Custom Domain', value: tenant.customDomain ?? '—' },
                  {
                    label: 'Created',
                    value: new Date(tenant.createdAt).toLocaleString(),
                  },
                  {
                    label: 'Last Updated',
                    value: new Date(tenant.updatedAt).toLocaleString(),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="text-sm font-medium break-all">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotas tab */}
        <TabsContent value="quotas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Quotas</CardTitle>
              <CardDescription>
                Usage against plan limits for{' '}
                <span className="font-medium">{tenant.plan}</span> plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {resourceQuotas.map((q) => (
                <QuotaGauge key={q.label} {...q} />
              ))}
              <Separator />
              <div className="grid gap-3 sm:grid-cols-3 text-center">
                <div className="rounded-lg border p-3">
                  <HardDrive className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-bold">{formatBytes(tenant.storageUsageBytes)}</p>
                  <p className="text-xs text-muted-foreground">Storage used</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Zap className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-bold">{tenant.apiCallsThisMonth.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">API calls / month</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Users className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-bold">{tenant.memberCount}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members tab */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>{tenant.memberCount} member{tenant.memberCount !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Member management requires a tenant-scoped API. Use impersonation to manage members directly.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing tab */}
        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Plan and payment information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{tenant.plan} Plan</p>
                    <p className="text-sm text-muted-foreground">Current subscription</p>
                  </div>
                  <Badge variant="outline">{tenant.status}</Badge>
                </div>
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <Globe className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Full billing management is available via the License API.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Suspend inline dialog */}
      <Dialog open={showSuspend} onOpenChange={setShowSuspend}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suspend Tenant</DialogTitle>
            <DialogDescription>
              Suspending <strong>{tenant.name}</strong> will immediately block all user access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason *</Label>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Describe the reason for suspension…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || saving}
            >
              {saving ? 'Suspending…' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImpersonateDialog
        tenant={tenant}
        open={showImpersonate}
        onOpenChange={setShowImpersonate}
      />

      <DeleteDialog
        tenant={tenant}
        open={showDelete}
        onOpenChange={setShowDelete}
        onDeleted={() => router.push('/platform-admin/tenants')}
      />
    </div>
  );
}
