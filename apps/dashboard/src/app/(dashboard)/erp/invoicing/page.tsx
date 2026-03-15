"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, FileText, Plus, XCircle } from "lucide-react";
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
} from "@unicore/ui";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CRYPTO"
  | "OTHER";

interface Invoice {
  id: string;
  invoiceNumber?: string;
  status: InvoiceStatus;
  contactId: string;
  contact?: { firstName: string; lastName: string };
  currency: string;
  total: number;
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
    className: "bg-gray-100 text-gray-700 border-gray-300",
    icon: FileText,
  },
  SENT: {
    label: "Sent",
    className: "bg-blue-100 text-blue-800 border-blue-300",
    icon: Clock,
  },
  PAID: {
    label: "Paid",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle2,
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: Clock,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-500 border-gray-200",
    icon: XCircle,
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as InvoiceStatus[];

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = STATUS_CONFIG[status];
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

  useEffect(() => {
    if (open) setForm(EMPTY_CREATE);
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
            <Label htmlFor="inv-contact">Contact ID *</Label>
            <Input
              id="inv-contact"
              value={form.contactId}
              onChange={(e) => set("contactId", e.target.value)}
              placeholder="UUID of the contact"
            />
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
      setAmount(String(invoice.total ?? ""));
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
            <Label htmlFor="pay-amount">Amount *</Label>
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
                  {m.replace("_", " ")}
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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">(
    "ALL",
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [sending, setSending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
    api
      .get<Invoice[]>(`/api/proxy/erp/invoices${query}`)
      .then(setInvoices)
      .catch((err) =>
        toast({
          title: "Failed to load invoices",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

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

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount,
    );

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Invoices</CardTitle>
            </div>
            <CardDescription>
              {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
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
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No invoices found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-48" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => {
                  const contactName = invoice.contact
                    ? `${invoice.contact.firstName} ${invoice.contact.lastName}`
                    : invoice.contactId;
                  const busy = sending.has(invoice.id);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">{contactName}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmt(invoice.total ?? 0, invoice.currency ?? "USD")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {invoice.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleSend(invoice)}
                            >
                              {busy ? "…" : "Send"}
                            </Button>
                          )}
                          {(invoice.status === "SENT" ||
                            invoice.status === "OVERDUE") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentTarget(invoice)}
                            >
                              Record Payment
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
