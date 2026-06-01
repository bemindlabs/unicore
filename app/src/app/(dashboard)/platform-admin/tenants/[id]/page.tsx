'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  HardDrive,
  KeyRound,
  ShieldCheck,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@bemindlabs/unicore-ui';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DELETED' | 'ARCHIVED';
type TenantPlan = 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';

interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  memberSince: string;
  userCreatedAt: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  detail: string | null;
  success: boolean;
}

/** GET /admin/tenants/:id/detail — full monitor view. */
interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  displayName?: string;
  customDomain?: string | null;
  plan: TenantPlan;
  status: TenantStatus;
  ownerEmail: string | null;
  memberCount: number;
  storageUsageBytes: number;
  apiCallsThisMonth: number;
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
  suspendReason?: string;
  subscription: {
    status: string;
    plan: string;
    trialEndsAt: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  usage: {
    apiCallsThisMonth: number;
    storageUsageBytes: number;
  };
  users: TenantUser[];
  recentActivity: ActivityEntry[];
}

interface ResourceQuota {
  label: string;
  used: number;
  max: number;
  formatValue: (v: number) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLANS: TenantPlan[] = ['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

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
  DELETED: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600',
};

function trialLabel(sub: TenantDetail['subscription']): string {
  if (sub.status === 'TRIALING' && sub.trialEndsAt) {
    const days = Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000);
    return days > 0 ? `Trial — ${days} day${days !== 1 ? 's' : ''} left` : 'Trial expired';
  }
  return sub.status;
}

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
// Change-plan control (CONTROL)
// ---------------------------------------------------------------------------

interface ChangePlanCardProps {
  tenant: TenantDetail;
  onChanged: (plan: TenantPlan) => void;
}

function ChangePlanCard({ tenant, onChanged }: ChangePlanCardProps) {
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (plan === tenant.plan) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/admin/tenants/${tenant.id}/plan`, { plan });
      onChanged(plan);
      toast({ title: 'Plan updated', description: `${tenant.name} is now on ${plan}.` });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      setPlan(tenant.plan);
    } finally {
      setSaving(false);
    }
  }, [plan, tenant.id, tenant.plan, tenant.name, onChanged]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" /> Change plan
        </CardTitle>
        <CardDescription>
          Move this business to a different plan. Entitlements follow the plan field.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as TenantPlan)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={plan === tenant.plan || saving}>
          {saving ? 'Saving…' : 'Save plan'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// User suspend / activate confirmation (CONTROL)
// ---------------------------------------------------------------------------

interface UserActionDialogProps {
  tenantId: string;
  user: TenantUser | null;
  action: 'suspend' | 'activate' | null;
  onClose: () => void;
  onDone: () => void;
}

function UserActionDialog({ tenantId, user, action, onClose, onDone }: UserActionDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!action) setReason('');
  }, [action]);

  const handleConfirm = useCallback(async () => {
    if (!user || !action) return;
    setBusy(true);
    try {
      const path = `/api/v1/admin/tenants/${tenantId}/users/${user.id}/${action}`;
      await api.post(path, action === 'suspend' ? { reason: reason.trim() || undefined } : {});
      toast({
        title: action === 'suspend' ? 'User suspended' : 'User reactivated',
        description: user.email,
      });
      onDone();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }, [user, action, tenantId, reason, onDone, onClose]);

  const open = Boolean(user && action);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === 'suspend' ? 'Suspend user' : 'Reactivate user'}
          </DialogTitle>
          <DialogDescription>
            {action === 'suspend' ? (
              <>
                Suspending <strong>{user?.email}</strong> revokes all their active
                sessions and locks them out of this business until reactivated.
              </>
            ) : (
              <>
                Reactivate <strong>{user?.email}</strong>. They regain access on next
                login.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {action === 'suspend' && (
          <div className="space-y-2 py-2">
            <Label>Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this user being suspended?"
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={action === 'suspend' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : action === 'suspend' ? 'Suspend' : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  tenant: TenantDetail;
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
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [userAction, setUserAction] = useState<{ user: TenantUser; action: 'suspend' | 'activate' } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<TenantDetail>(`/api/v1/admin/tenants/${params.id}/detail`)
      .then(setTenant)
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSuspend = useCallback(async () => {
    if (!tenant || !suspendReason.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/admin/tenants/${tenant.id}/suspend`, {
        reason: suspendReason.trim(),
      });
      setShowSuspend(false);
      setSuspendReason('');
      toast({ title: 'Tenant suspended' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant, suspendReason, load]);

  const handleActivate = useCallback(async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/admin/tenants/${tenant.id}/activate`, {});
      toast({ title: 'Tenant reactivated' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant, load]);

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
            Tenant not found or the monitor endpoint is not available.
          </CardContent>
        </Card>
      </div>
    );
  }

  const quotas = PLAN_QUOTAS[tenant.plan] ?? PLAN_QUOTAS.STARTER;
  const usage = tenant.usage ?? {
    apiCallsThisMonth: tenant.apiCallsThisMonth,
    storageUsageBytes: tenant.storageUsageBytes,
  };
  const resourceQuotas: ResourceQuota[] = [
    {
      label: 'Storage',
      used: usage.storageUsageBytes,
      max: quotas.storage,
      formatValue: formatBytes,
    },
    {
      label: 'API Calls / Month',
      used: usage.apiCallsThisMonth,
      max: quotas.apiPerDay * 30,
      formatValue: (v) => v.toLocaleString(),
    },
    {
      label: 'Members',
      used: tenant.memberCount,
      max: quotas.users,
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

      {/* Monitor summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Subscription</p>
              <p className="text-sm font-semibold">{trialLabel(tenant.subscription)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Members</p>
              <p className="text-sm font-semibold">{tenant.memberCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">API calls / mo</p>
              <p className="text-sm font-semibold">{usage.apiCallsThisMonth.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Storage</p>
              <p className="text-sm font-semibold">{formatBytes(usage.storageUsageBytes)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="control">Control</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Tenant ID', value: tenant.id },
                  { label: 'Slug', value: tenant.slug },
                  { label: 'Owner Email', value: tenant.ownerEmail ?? '—' },
                  { label: 'Plan', value: tenant.plan },
                  { label: 'Status', value: tenant.status },
                  { label: 'Custom Domain', value: tenant.customDomain ?? '—' },
                  { label: 'Subscription', value: tenant.subscription.status },
                  {
                    label: 'Trial Ends',
                    value: tenant.subscription.trialEndsAt
                      ? new Date(tenant.subscription.trialEndsAt).toLocaleDateString()
                      : '—',
                  },
                  { label: 'Stripe Customer', value: tenant.subscription.stripeCustomerId ?? '—' },
                  { label: 'Created', value: new Date(tenant.createdAt).toLocaleString() },
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

        {/* Usage tab */}
        <TabsContent value="usage" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
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
                  <p className="text-lg font-bold">{formatBytes(usage.storageUsageBytes)}</p>
                  <p className="text-xs text-muted-foreground">Storage used</p>
                </div>
                <div className="rounded-lg border p-3">
                  <Zap className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-lg font-bold">{usage.apiCallsThisMonth.toLocaleString()}</p>
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

        {/* Users tab — MONITOR + per-user CONTROL */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                {tenant.memberCount} member{tenant.memberCount !== 1 ? 's' : ''} in this business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tenant.users.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No members found.
                </div>
              ) : (
                tenant.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                        {u.isSuperAdmin && (
                          <Badge variant="outline" className="gap-1 text-xs">
                            <ShieldCheck className="h-3 w-3" /> super-admin
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email} · {u.role} · since {new Date(u.memberSince).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={u.isSuperAdmin}
                        onClick={() => setUserAction({ user: u, action: 'suspend' })}
                      >
                        <Ban className="mr-1.5 h-3.5 w-3.5" /> Suspend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserAction({ user: u, action: 'activate' })}
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Activate
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity tab — MONITOR */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Recent Activity
              </CardTitle>
              <CardDescription>Last {tenant.recentActivity.length} audit events for this tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {tenant.recentActivity.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No recent activity recorded.
                </div>
              ) : (
                tenant.recentActivity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 border-b py-2 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {a.action} · <span className="text-muted-foreground">{a.resource}</span>
                      </p>
                      {a.detail && (
                        <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {a.userEmail ?? 'system'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={a.success ? 'outline' : 'destructive'} className="text-xs">
                        {a.success ? 'ok' : 'fail'}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(a.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Control tab — CONTROL */}
        <TabsContent value="control" className="mt-4 space-y-4">
          <ChangePlanCard
            tenant={tenant}
            onChanged={(plan) => setTenant((prev) => (prev ? { ...prev, plan } : prev))}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" /> Lifecycle
              </CardTitle>
              <CardDescription>Suspend or reactivate the whole business.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {tenant.status === 'ACTIVE' ? (
                <Button variant="destructive" onClick={() => setShowSuspend(true)}>
                  <Ban className="mr-2 h-4 w-4" /> Suspend business
                </Button>
              ) : (
                <Button onClick={handleActivate} disabled={saving}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate business
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Suspend tenant dialog */}
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

      <UserActionDialog
        tenantId={tenant.id}
        user={userAction?.user ?? null}
        action={userAction?.action ?? null}
        onClose={() => setUserAction(null)}
        onDone={load}
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
