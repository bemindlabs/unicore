"use client";

import { useCallback, useEffect, useState } from "react";
import { type PaginationMeta } from "@/components/Pagination";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  FileText,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import {
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
} from "@bemindlabs/unicore-ui";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format-currency";
import { useBusinessTimezone, formatDateTz } from "@/hooks/use-business-timezone";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID"
  | "WRITTEN_OFF";

type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "STRIPE"
  | "PAYPAL"
  | "PROMPTPAY"
  | "QR_CODE"
  | "CRYPTO"
  | "OTHER";

interface Invoice {
  id: string;
  invoiceNumber?: string;
  status: InvoiceStatus;
  contactId: string;
  contact?: { id: string; name: string; email?: string };
  currency: string;
  total: string | number;
  amountPaid?: string | number;
  amountDue?: string | number;
  dueDate?: string;
  createdAt: string;
  notes?: string;
}

interface CreateInvoiceForm {
  contactId: string;
  currency: string;
  dueDate: string;
  notes: string;
}

const EMPTY_CREATE: CreateInvoiceForm = {
  contactId: "",
  currency: "USD",
  dueDate: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-600",
    icon: FileText,
  },
  SENT: {
    label: "Sent",
    className: "bg-zinc-100 text-zinc-800 border-zinc-300",
    icon: Clock,
  },
  VIEWED: {
    label: "Viewed",
    className: "bg-cyan-100 text-cyan-800 border-cyan-300",
    icon: Eye,
  },
  PARTIALLY_PAID: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-300",
    icon: DollarSign,
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle2,
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: AlertTriangle,
  },
  VOID: {
    label: "Void",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
    icon: Ban,
  },
  WRITTEN_OFF: {
    label: "Written Off",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600",
    icon: XCircle,
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as InvoiceStatus[];

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create Invoice Dialog
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  name: string;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (invoice: Invoice) => void;
}

function CreateInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateInvoiceDialogProps) {
  const [form, setForm] = useState<CreateInvoiceForm>(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_CREATE);
      setContactsLoading(true);
      api
        .get<Contact[]>("/api/proxy/erp/contacts")
        .then((res) => setContacts(Array.isArray(res) ? res : (res as any).data ?? []))
        .catch(() => setContacts([]))
        .finally(() => setContactsLoading(false));
    }
  }, [open]);

  const set = (field: keyof CreateInvoiceForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.contactId.trim()) return;
    setSaving(true);
    try {
      const payload = {
        contactId: form.contactId.trim(),
        currency: form.currency.trim() || "USD",
        lineItems: [],
        ...(form.dueDate && { dueDate: form.dueDate }),
        ...(form.notes.trim() && { notes: form.notes.trim() }),
      };
      const invoice = await api.post<Invoice>(
        "/api/proxy/erp/invoices",
        payload,
      );
      onCreated(invoice);
      onOpenChange(false);
      toast({ title: "Invoice created" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [form, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for a contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="inv-contact">Contact <span className="text-red-500">*</span></Label>
            <select
              id="inv-contact"
              value={form.contactId}
              onChange={(e) => set("contactId", e.target.value)}
              disabled={contactsLoading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">{contactsLoading ? "Loading contacts…" : "Select a contact"}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inv-currency">Currency</Label>
              <Input
                id="inv-currency"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                placeholder="USD"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-due">Due Date</Label>
              <Input
                id="inv-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inv-notes">Notes</Label>
            <Input
              id="inv-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.contactId.trim() || saving}
          >
            {saving ? "Creating…" : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Record Payment Dialog
// ---------------------------------------------------------------------------

interface RecordPaymentDialogProps {
  invoice: Invoice | null;
  onClose: () => void;
  onRecorded: (invoice: Invoice) => void;
}

function RecordPaymentDialog({
  invoice,
  onClose,
  onRecorded,
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount(String(Number(invoice.amountDue ?? invoice.total) || ""));
      setMethod("BANK_TRANSFER");
      setReference("");
    }
  }, [invoice]);

  const handleRecord = useCallback(async () => {
    if (!invoice || !amount) return;
    setSaving(true);
    try {
      const updated = await api.post<Invoice>(
        `/api/proxy/erp/invoices/${invoice.id}/record-payment`,
        {
          amount: parseFloat(amount),
          currency: invoice.currency ?? "USD",
          method,
          ...(reference.trim() && { reference: reference.trim() }),
        },
      );
      onRecorded(updated);
      onClose();
      toast({ title: "Payment recorded" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [invoice, amount, method, reference, onRecorded, onClose]);

  const METHODS: PaymentMethod[] = [
    "CASH",
    "BANK_TRANSFER",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "STRIPE",
    "PAYPAL",
    "PROMPTPAY",
    "QR_CODE",
    "CRYPTO",
    "OTHER",
  ];

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for invoice{" "}
            <strong>
              {invoice?.invoiceNumber ?? invoice?.id?.slice(0, 8)}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="pay-amount">Amount <span className="text-red-500">*</span></Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-method">Payment Method</Label>
            <select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pay-ref">Reference</Label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transaction ID, cheque no., etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRecord} disabled={!amount || saving}>
            {saving ? "Recording…" : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InvoicingPage() {
  const tz = useBusinessTimezone();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter !== "ALL") params.set('status', statusFilter);
    api
      .get<any>(`/api/proxy/erp/invoices?${params}`)
      .then((res) => {
        setInvoices(Array.isArray(res) ? res : res?.data ?? []);
        if (res?.meta) setMeta(res.meta);
      })
      .catch((err) =>
        toast({
          title: "Failed to load invoices",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleSend = useCallback(async (invoice: Invoice) => {
    setSending((prev) => new Set(prev).add(invoice.id));
    try {
      const updated = await api.post<Invoice>(
        `/api/proxy/erp/invoices/${invoice.id}/send`,
        {},
      );
      setInvoices((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      toast({ title: "Invoice sent" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSending((prev) => {
        const next = new Set(prev);
        next.delete(invoice.id);
        return next;
      });
    }
  }, []);

  const handleCancel = useCallback(async (invoice: Invoice) => {
    try {
      const updated = await api.post<Invoice>(
        `/api/proxy/erp/invoices/${invoice.id}/cancel`,
        {},
      );
      setInvoices((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i)),
      );
      toast({ title: "Invoice voided" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }, []);

  const handleCreated = useCallback(
    (invoice: Invoice) => setInvoices((prev) => [invoice, ...prev]),
    [],
  );
  const handleRecorded = useCallback(
    (invoice: Invoice) =>
      setInvoices((prev) =>
        prev.map((i) => (i.id === invoice.id ? invoice : i)),
      ),
    [],
  );

  const fmt = (amount: string | number, currency: string) =>
    formatCurrency(amount, currency);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Invoices</CardTitle>
            </div>
            <CardDescription>
              {meta.total} invoice{meta.total !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {(["ALL", ...ALL_STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {s === "ALL" ? "All" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No invoices yet. Create your first invoice to get started.
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="block md:hidden space-y-3">
                {invoices.map((invoice) => {
                  const contactName = invoice.contact?.name ?? invoice.contactId;
                  const busy = sending.has(invoice.id);
                  return (
                    <div key={invoice.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium">{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}</span>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <div className="text-sm">{contactName}</div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{fmt(invoice.total, invoice.currency ?? "USD")}</span>
                        <span className="text-muted-foreground">Paid: {fmt(invoice.amountPaid ?? 0, invoice.currency ?? "USD")}</span>
                      </div>
                      {invoice.dueDate && (
                        <div className="text-xs text-muted-foreground">Due: {formatDateTz(invoice.dueDate, tz)}</div>
                      )}
                      <div className="flex items-center gap-1 pt-1">
                        {invoice.status === "DRAFT" && (
                          <Button variant="outline" size="sm" disabled={busy} onClick={() => handleSend(invoice)}>{busy ? "…" : "Send"}</Button>
                        )}
                        {["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
                          <Button variant="outline" size="sm" onClick={() => setPaymentTarget(invoice)}>Record Payment</Button>
                        )}
                        {["DRAFT", "SENT", "VIEWED"].includes(invoice.status) && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleCancel(invoice)}>Void</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="w-48" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const contactName = invoice.contact?.name ?? invoice.contactId;
                      const busy = sending.has(invoice.id);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-sm">{contactName}</TableCell>
                          <TableCell><StatusBadge status={invoice.status} /></TableCell>
                          <TableCell className="text-sm">{fmt(invoice.total, invoice.currency ?? "USD")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{fmt(invoice.amountPaid ?? 0, invoice.currency ?? "USD")}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{invoice.dueDate ? formatDateTz(invoice.dueDate, tz) : "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {invoice.status === "DRAFT" && (
                                <Button variant="outline" size="sm" disabled={busy} onClick={() => handleSend(invoice)}>{busy ? "…" : "Send"}</Button>
                              )}
                              {["SENT", "VIEWED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && (
                                <Button variant="outline" size="sm" onClick={() => setPaymentTarget(invoice)}>Record Payment</Button>
                              )}
                              {["DRAFT", "SENT", "VIEWED"].includes(invoice.status) && (
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleCancel(invoice)}>Void</Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <RecordPaymentDialog
        invoice={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onRecorded={handleRecorded}
      />
    </div>
  );
}
