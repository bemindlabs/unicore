"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
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
} from "@unicore/ui";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "FULFILLED"
  | "CANCELLED"
  | "REFUNDED";

interface Order {
  id: string;
  orderNumber?: string;
  status: OrderStatus;
  contactId: string;
  contact?: { firstName: string; lastName: string };
  currency: string;
  total: number;
  createdAt: string;
  notes?: string;
}

interface CreateOrderForm {
  contactId: string;
  currency: string;
  notes: string;
}

const EMPTY_FORM: CreateOrderForm = {
  contactId: "",
  currency: "USD",
  notes: "",
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-blue-100 text-blue-800 border-blue-300",
    icon: CheckCircle2,
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-indigo-100 text-indigo-800 border-indigo-300",
    icon: RefreshCw,
  },
  SHIPPED: {
    label: "Shipped",
    className: "bg-purple-100 text-purple-800 border-purple-300",
    icon: Truck,
  },
  FULFILLED: {
    label: "Fulfilled",
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: PackageCheck,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
  },
  REFUNDED: {
    label: "Refunded",
    className: "bg-gray-100 text-gray-700 border-gray-300",
    icon: XCircle,
  },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as OrderStatus[];

function StatusBadge({ status }: { status: OrderStatus }) {
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
// Status Transition helpers
// ---------------------------------------------------------------------------

const TRANSITIONS: Partial<
  Record<OrderStatus, { label: string; action: string }>
> = {
  PENDING: { label: "Confirm", action: "confirm" },
  CONFIRMED: { label: "Start Processing", action: "start-processing" },
  PROCESSING: { label: "Mark Shipped", action: "ship" },
  SHIPPED: { label: "Mark Fulfilled", action: "fulfill" },
};

// ---------------------------------------------------------------------------
// Create Order Dialog
// ---------------------------------------------------------------------------

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (order: Order) => void;
}

function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrderDialogProps) {
  const [form, setForm] = useState<CreateOrderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setContactsLoading(true);
      api
        .get<Contact[]>("/api/proxy/erp/contacts")
        .then((res) => setContacts(Array.isArray(res) ? res : (res as any).data ?? []))
        .catch(() => setContacts([]))
        .finally(() => setContactsLoading(false));
    }
  }, [open]);

  const set = (field: keyof CreateOrderForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.contactId.trim()) return;
    setSaving(true);
    try {
      const payload = {
        contactId: form.contactId.trim(),
        currency: form.currency.trim() || "USD",
        lineItems: [],
        ...(form.notes.trim() && { notes: form.notes.trim() }),
      };
      const order = await api.post<Order>("/api/proxy/erp/orders", payload);
      onCreated(order);
      onOpenChange(false);
      toast({ title: "Order created" });
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
          <DialogTitle>New Order</DialogTitle>
          <DialogDescription>
            Create a new order for a contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="o-contact">Contact *</Label>
            <select
              id="o-contact"
              value={form.contactId}
              onChange={(e) => set("contactId", e.target.value)}
              disabled={contactsLoading}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">{contactsLoading ? "Loading contacts…" : "Select a contact"}</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-currency">Currency</Label>
            <Input
              id="o-currency"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              placeholder="USD"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-notes">Notes</Label>
            <Input
              id="o-notes"
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
            {saving ? "Creating…" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cancel Dialog
// ---------------------------------------------------------------------------

interface CancelDialogProps {
  order: Order | null;
  onClose: () => void;
  onCancelled: (order: Order) => void;
}

function CancelDialog({ order, onClose, onCancelled }: CancelDialogProps) {
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (order) setReason("");
  }, [order]);

  const handleCancel = useCallback(async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await api.post<Order>(
        `/api/proxy/erp/orders/${order.id}/cancel`,
        { reason: reason.trim() || "Cancelled by user" },
      );
      onCancelled(updated);
      onClose();
      toast({ title: "Order cancelled" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  }, [order, reason, onCancelled, onClose]);

  return (
    <Dialog open={!!order} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription>
            Provide a reason for cancelling order{" "}
            <strong>{order?.orderNumber ?? order?.id}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Input
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional cancellation reason"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling…" : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());

  useEffect(() => {
    const query = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
    api
      .get<Order[]>(`/api/proxy/erp/orders${query}`)
      .then((res) => setOrders(Array.isArray(res) ? res : (res as any).data ?? []))
      .catch((err) =>
        toast({
          title: "Failed to load orders",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleTransition = useCallback(async (order: Order, action: string) => {
    setTransitioning((prev) => new Set(prev).add(order.id));
    try {
      const updated = await api.post<Order>(
        `/api/proxy/erp/orders/${order.id}/${action}`,
        {},
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      toast({
        title: `Order ${STATUS_CONFIG[updated.status]?.label ?? "updated"}`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setTransitioning((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  }, []);

  const handleCreated = useCallback(
    (order: Order) => setOrders((prev) => [order, ...prev]),
    [],
  );
  const handleCancelled = useCallback(
    (order: Order) =>
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o))),
    [],
  );

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount,
    );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <CardTitle>Orders</CardTitle>
            </div>
            <CardDescription>
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Order
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
          ) : orders.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              No orders yet. Create your first order to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const transition =
                    order.status in TRANSITIONS
                      ? TRANSITIONS[order.status]
                      : null;
                  const busy = transitioning.has(order.id);
                  const contactName = order.contact
                    ? `${order.contact.firstName} ${order.contact.lastName}`
                    : order.contactId;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-sm">
                        {order.orderNumber ?? order.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">{contactName}</TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmt(order.total ?? 0, order.currency ?? "USD")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {transition && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                handleTransition(order, transition.action)
                              }
                            >
                              {busy ? "…" : transition.label}
                            </Button>
                          )}
                          {order.status !== "CANCELLED" &&
                            order.status !== "REFUNDED" &&
                            order.status !== "FULFILLED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setCancelTarget(order)}
                              >
                                Cancel
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

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
      <CancelDialog
        order={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
