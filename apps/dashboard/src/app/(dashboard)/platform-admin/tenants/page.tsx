'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { Pagination, type PaginationMeta } from '@/components/Pagination';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
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

interface TenantList {
  items: Tenant[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<TenantStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  SUSPENDED: 'bg-red-100 text-red-800 border-red-300',
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  DELETED: 'bg-gray-100 text-gray-600 border-gray-300',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-300',
};

const PLAN_COLORS: Record<TenantPlan, string> = {
  STARTER: 'bg-blue-100 text-blue-800 border-blue-300',
  GROWTH: 'bg-violet-100 text-violet-800 border-violet-300',
  ENTERPRISE: 'bg-amber-100 text-amber-800 border-amber-300',
  CUSTOM: 'bg-pink-100 text-pink-800 border-pink-300',
};

function StatusBadge({ status }: { status: TenantStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: TenantPlan }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[plan]}`}>
      {plan}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ---------------------------------------------------------------------------
// Suspend Dialog
// ---------------------------------------------------------------------------

interface SuspendDialogProps {
  tenant: Tenant | null;
  onClose: () => void;
  onSuspended: (updated: Tenant) => void;
}

function SuspendDialog({ tenant, onClose, onSuspended }: SuspendDialogProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant) setReason('');
  }, [tenant]);

  const handleSuspend = useCallback(async () => {
    if (!tenant || !reason.trim()) return;
    setSaving(true);
    try {
      const updated = await api.post<Tenant>(
        `/api/v1/admin/tenants/${tenant.id}/suspend`,
        { reason: reason.trim() },
      );
      onSuspended(updated);
      onClose();
      toast({ title: `Tenant "${tenant.name}" suspended` });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant, reason, onSuspended, onClose]);

  return (
    <Dialog open={!!tenant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suspend Tenant</DialogTitle>
          <DialogDescription>
            Suspending <strong>{tenant?.name}</strong> will immediately block all user access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="suspend-reason">Reason *</Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this tenant is being suspended…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={!reason.trim() || saving}
          >
            {saving ? 'Suspending…' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Activate Confirmation Dialog
// ---------------------------------------------------------------------------

interface ActivateDialogProps {
  tenant: Tenant | null;
  onClose: () => void;
  onActivated: (updated: Tenant) => void;
}

function ActivateDialog({ tenant, onClose, onActivated }: ActivateDialogProps) {
  const [saving, setSaving] = useState(false);

  const handleActivate = useCallback(async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const updated = await api.post<Tenant>(`/api/v1/admin/tenants/${tenant.id}/activate`, {});
      onActivated(updated);
      onClose();
      toast({ title: `Tenant "${tenant.name}" reactivated` });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tenant, onActivated, onClose]);

  return (
    <Dialog open={!!tenant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivate Tenant</DialogTitle>
          <DialogDescription>
            This will restore full access for <strong>{tenant?.name}</strong> and all its users.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleActivate} disabled={saving}>
            {saving ? 'Activating…' : 'Reactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const STATUSES: Array<TenantStatus | ''> = ['', 'ACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED', 'DELETED'];
const PLANS: Array<TenantPlan | ''> = ['', 'STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM'];

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('');
  const [planFilter, setPlanFilter] = useState<TenantPlan | ''>('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [suspendTarget, setSuspendTarget] = useState<Tenant | null>(null);
  const [activateTarget, setActivateTarget] = useState<Tenant | null>(null);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (planFilter) params.set('plan', planFilter);

    api
      .get<TenantList>(`/api/v1/admin/tenants?${params}`)
      .then((res) => {
        setTenants(res.items ?? []);
        setMeta({
          page: res.page,
          limit: res.limit,
          total: res.total,
          totalPages: Math.ceil(res.total / res.limit),
        });
      })
      .catch((err) =>
        toast({ title: 'Failed to load tenants', description: err.message, variant: 'destructive' }),
      )
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);
  useEffect(() => { setPage(1); }, [search, statusFilter, planFilter]);

  const updateTenant = useCallback((updated: Tenant) => {
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Tenants</CardTitle>
            </div>
            <CardDescription>{meta.total} tenant{meta.total !== 1 ? 's' : ''}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchTenants} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/platform-admin/tenants/new">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Tenant
              </Button>
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search tenants…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TenantStatus | '')}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All statuses</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value as TenantPlan | '')}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All plans</option>
              {PLANS.filter(Boolean).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No tenants found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">Storage</TableHead>
                    <TableHead className="text-right">API / month</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.displayName ?? tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tenant.ownerEmail}
                      </TableCell>
                      <TableCell>
                        <PlanBadge plan={tenant.plan} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tenant.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm">{tenant.memberCount}</TableCell>
                      <TableCell className="text-right text-sm">{formatBytes(tenant.storageUsageBytes)}</TableCell>
                      <TableCell className="text-right text-sm">
                        {tenant.apiCallsThisMonth.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/platform-admin/tenants/${tenant.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {tenant.status === 'ACTIVE' && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setSuspendTarget(tenant)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            {tenant.status === 'SUSPENDED' && (
                              <DropdownMenuItem onClick={() => setActivateTarget(tenant)}>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </CardContent>
      </Card>

      <SuspendDialog
        tenant={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onSuspended={updateTenant}
      />
      <ActivateDialog
        tenant={activateTarget}
        onClose={() => setActivateTarget(null)}
        onActivated={updateTenant}
      />
    </div>
  );
}
