"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Info,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@unicore/ui";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DomainStatus =
  | "pending"
  | "verifying"
  | "verified"
  | "active"
  | "error";
export type SslStatus = "pending" | "active" | "error";

export interface DnsRecord {
  type: "TXT" | "CNAME" | "A";
  name: string;
  value: string;
  ttl: number;
}

export interface SslCertificate {
  issuer: string;
  expiresAt: string;
  issuedAt: string;
  subject: string;
}

export interface VerificationEvent {
  timestamp: string;
  message: string;
  success: boolean;
}

export interface Domain {
  id: string;
  name: string;
  status: DomainStatus;
  sslStatus: SslStatus;
  verifiedAt?: string;
  addedAt: string;
  dnsRecords: DnsRecord[];
  sslCertificate?: SslCertificate;
  verificationHistory: VerificationEvent[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const DOMAIN_STATUS_CONFIG: Record<
  DomainStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
  },
  verifying: {
    label: "Verifying",
    className: "bg-blue-100 text-blue-800 border-blue-300",
    icon: RefreshCw,
  },
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle2,
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle2,
  },
  error: {
    label: "Error",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
  },
};

const SSL_STATUS_CONFIG: Record<
  SslStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
  },
  active: {
    label: "SSL Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: Lock,
  },
  error: {
    label: "SSL Error",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
  },
};

function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const config = DOMAIN_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function SslStatusBadge({ status }: { status: SslStatus }) {
  const config = SSL_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidDomain(value: string): boolean {
  // Basic hostname validation: labels separated by dots, no leading/trailing hyphens
  const pattern =
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(value.trim());
}

// ---------------------------------------------------------------------------
// Add Domain Dialog
// ---------------------------------------------------------------------------

interface AddDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (domain: Domain) => void;
}

function AddDomainDialog({ open, onOpenChange, onAdd }: AddDomainDialogProps) {
  const [domainValue, setDomainValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [touched, setTouched] = useState(false);

  const isValid = isValidDomain(domainValue);
  const showError = touched && !isValid && domainValue.trim() !== "";

  const handleAdd = useCallback(async () => {
    if (!isValid) return;
    setIsAdding(true);
    try {
      const created = await api.post<Domain>("/settings/domains", {
        hostname: domainValue.trim(),
      });
      onAdd(created);
      setDomainValue("");
      setTouched(false);
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Failed to add domain",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  }, [isValid, domainValue, onAdd, onOpenChange]);

  const handleClose = useCallback(() => {
    setDomainValue("");
    setTouched(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Custom Domain</DialogTitle>
          <DialogDescription>
            Connect a custom domain to your UniCore dashboard. You will need to
            add DNS records to your domain registrar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Domain input */}
          <div className="space-y-2">
            <Label htmlFor="domain-input">Domain Name</Label>
            <Input
              id="domain-input"
              type="text"
              placeholder="app.yourdomain.com"
              value={domainValue}
              onChange={(e) => setDomainValue(e.target.value)}
              onBlur={() => setTouched(true)}
              className={
                showError ? "border-red-400 focus-visible:ring-red-400" : ""
              }
            />
            {showError && (
              <p className="text-xs text-red-600">
                Please enter a valid domain name (e.g. app.yourdomain.com)
              </p>
            )}
          </div>

          {/* DNS Setup Instructions */}
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-primary" />
              DNS Setup Instructions
            </div>
            <p className="text-xs text-muted-foreground">
              After adding your domain, set the following DNS records with your
              registrar:
            </p>

            {/* TXT record */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                1. Verification (TXT Record)
              </p>
              <div className="rounded border bg-background font-mono text-xs p-2 space-y-0.5">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Type
                  </span>
                  <span>TXT</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Name
                  </span>
                  <span className="break-all">
                    _unicore-verify.{domainValue.trim() || "<your-domain>"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Value
                  </span>
                  <span className="break-all">
                    unicore-verify=&lt;token-provided-after-save&gt;
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    TTL
                  </span>
                  <span>300</span>
                </div>
              </div>
            </div>

            {/* CNAME record */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                2. Routing (CNAME Record)
              </p>
              <div className="rounded border bg-background font-mono text-xs p-2 space-y-0.5">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Type
                  </span>
                  <span>CNAME</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Name
                  </span>
                  <span className="break-all">
                    {domainValue.trim() || "<your-domain>"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    Value
                  </span>
                  <span>ingress.unicore.cloud</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-12 shrink-0">
                    TTL
                  </span>
                  <span>300</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              DNS propagation may take up to 48 hours. SSL will be provisioned
              automatically once verified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!isValid || isAdding}>
            {isAdding ? "Adding…" : "Add Domain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Remove Domain Confirmation Dialog
// ---------------------------------------------------------------------------

interface RemoveDomainDialogProps {
  domain: Domain | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

function RemoveDomainDialog({
  domain,
  onClose,
  onConfirm,
}: RemoveDomainDialogProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!domain) return;
    setIsRemoving(true);
    try {
      await api.delete(`/settings/domains/${domain.id}`);
      onConfirm(domain.id);
      onClose();
    } catch (err: unknown) {
      toast({
        title: "Failed to remove domain",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  }, [domain, onConfirm, onClose]);

  return (
    <Dialog open={!!domain} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Remove Domain
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to remove <strong>{domain?.name}</strong>?
            This will revoke the SSL certificate and stop routing traffic
            through UniCore. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isRemoving}
          >
            {isRemoving ? "Removing…" : "Remove Domain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Domain Detail Panel
// ---------------------------------------------------------------------------

interface DomainDetailPanelProps {
  domain: Domain;
}

function DomainDetailPanel({ domain }: DomainDetailPanelProps) {
  return (
    <div className="space-y-5 pt-2">
      {/* DNS Records */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required DNS Records
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-16">TTL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {domain.dnsRecords.map((record, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">
                    {record.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs break-all">
                  {record.name}
                </TableCell>
                <TableCell className="font-mono text-xs break-all">
                  {record.value}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {record.ttl}s
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* SSL Certificate */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          SSL Certificate
        </p>
        {domain.sslCertificate ? (
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Issuer</p>
              <p className="font-medium">{domain.sslCertificate.issuer}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="font-medium font-mono">
                {domain.sslCertificate.subject}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Issued</p>
              <p className="font-medium">{domain.sslCertificate.issuedAt}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="font-medium">{domain.sslCertificate.expiresAt}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            SSL certificate will be provisioned after domain verification
            completes.
          </div>
        )}
      </div>

      {/* Verification Timeline */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Verification History
        </p>
        <ol className="space-y-2">
          {domain.verificationHistory.map((event, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs">
              {event.success ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
              )}
              <div>
                <p
                  className={
                    event.success ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {event.message}
                </p>
                <p className="text-muted-foreground/70">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Domain | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [sslRefreshingIds, setSslRefreshingIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    api
      .get<Domain[]>("/settings/domains")
      .then(setDomains)
      .catch((err: unknown) => {
        toast({
          title: "Failed to load domains",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAddDomain = useCallback((domain: Domain) => {
    setDomains((prev) => [domain, ...prev]);
    toast({
      title: "Domain added",
      description: `${domain.name} is pending DNS verification.`,
    });
  }, []);

  const handleRemoveDomain = useCallback(
    (id: string) => {
      const domain = domains.find((d) => d.id === id);
      setDomains((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Domain removed", description: domain?.name });
    },
    [domains, expandedId],
  );

  const handleReverify = useCallback(async (id: string) => {
    setVerifyingIds((prev) => new Set(prev).add(id));
    try {
      const updated = await api.post<Domain>(`/settings/domains/${id}/verify`);
      setDomains((prev) => prev.map((d) => (d.id === id ? updated : d)));
      toast({
        title: "Verification started",
        description: "DNS check is running in the background.",
      });
    } catch (err: unknown) {
      toast({
        title: "Verification failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const handleForceSslRefresh = useCallback(async (id: string) => {
    setSslRefreshingIds((prev) => new Set(prev).add(id));
    try {
      await api.post(`/settings/domains/${id}/ssl-refresh`);
      toast({
        title: "SSL refresh queued",
        description: "Certificate renewal has been requested.",
      });
    } catch (err: unknown) {
      toast({
        title: "SSL refresh failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSslRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Custom Domains</CardTitle>
            </div>
            <CardDescription>
              {domains.length} domain{domains.length !== 1 ? "s" : ""}{" "}
              configured
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Domain
          </Button>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Loading domains…
            </div>
          ) : domains.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No domains configured. Click "Add Domain" to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((domain) => {
                const isExpanded = expandedId === domain.id;
                const isVerifying = verifyingIds.has(domain.id);
                const isSslRefreshing = sslRefreshingIds.has(domain.id);

                return (
                  <div key={domain.id} className="rounded-lg border">
                    {/* Domain row */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpanded(domain.id)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={
                          isExpanded ? "Collapse details" : "Expand details"
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      {/* Domain name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono truncate">
                          {domain.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added {domain.addedAt}
                        </p>
                      </div>

                      {/* Status badges */}
                      <div className="hidden sm:flex items-center gap-2">
                        <DomainStatusBadge status={domain.status} />
                        <SslStatusBadge status={domain.sslStatus} />
                      </div>

                      {/* Verified date */}
                      {domain.verifiedAt && (
                        <p className="hidden lg:block text-xs text-muted-foreground whitespace-nowrap">
                          Verified {domain.verifiedAt}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReverify(domain.id)}
                          disabled={isVerifying}
                          title="Re-verify domain"
                        >
                          <ShieldCheck
                            className={`h-4 w-4 ${isVerifying ? "animate-pulse" : ""}`}
                          />
                          <span className="sr-only">Re-verify</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleForceSslRefresh(domain.id)}
                          disabled={isSslRefreshing}
                          title="Force SSL refresh"
                        >
                          <Lock
                            className={`h-4 w-4 ${isSslRefreshing ? "animate-pulse" : ""}`}
                          />
                          <span className="sr-only">Force SSL refresh</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRemoveTarget(domain)}
                          title="Remove domain"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </div>

                    {/* Mobile status badges */}
                    <div className="flex sm:hidden items-center gap-2 px-4 pb-3">
                      <DomainStatusBadge status={domain.status} />
                      <SslStatusBadge status={domain.sslStatus} />
                    </div>

                    {/* Detail panel */}
                    {isExpanded && (
                      <div className="border-t px-4 pb-4">
                        <DomainDetailPanel domain={domain} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddDomainDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={handleAddDomain}
      />

      <RemoveDomainDialog
        domain={removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveDomain}
      />
    </div>
  );
}
