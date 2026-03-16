"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, Pencil, Plus, Search, Trash2 } from "lucide-react";
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

type ExpenseStatus = "PENDING" | "APPROVED" | "REJECTED" | "REIMBURSED";

type ExpenseCategory =
  | "TRAVEL"
  | "OFFICE_SUPPLIES"
  | "SOFTWARE"
  | "MARKETING"
  | "MEALS"
  | "EQUIPMENT"
  | "OTHER";

interface Expense {
  id: string;
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  status: ExpenseStatus;
  createdAt: string;
}

interface ExpenseForm {
  date: string;
  description: string;
  category: ExpenseCategory;
  amount: string;
  status: ExpenseStatus;
}

const EMPTY_FORM: ExpenseForm = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  category: "OTHER",
  amount: "",
  status: "PENDING",
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL: "Travel",
  OFFICE_SUPPLIES: "Office Supplies",
  SOFTWARE: "Software",
  MARKETING: "Marketing",
  MEALS: "Meals",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

const ALL_CATEGORIES: ExpenseCategory[] = [
  "TRAVEL",
  "OFFICE_SUPPLIES",
  "SOFTWARE",
  "MARKETING",
  "MEALS",
  "EQUIPMENT",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  REIMBURSED: "bg-blue-100 text-blue-800 border-blue-300",
};

function StatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {status}
    </span>
  );
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  TRAVEL: "bg-sky-100 text-sky-800 border-sky-300",
  OFFICE_SUPPLIES: "bg-slate-100 text-slate-800 border-slate-300",
  SOFTWARE: "bg-violet-100 text-violet-800 border-violet-300",
  MARKETING: "bg-pink-100 text-pink-800 border-pink-300",
  MEALS: "bg-orange-100 text-orange-800 border-orange-300",
  EQUIPMENT: "bg-teal-100 text-teal-800 border-teal-300",
  OTHER: "bg-gray-100 text-gray-800 border-gray-300",
};

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | ExpenseStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

// ---------------------------------------------------------------------------
// Expense Dialog (create / edit)
// ---------------------------------------------------------------------------

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Expense | null;
  onSaved: (expense: Expense) => void;
}

function ExpenseDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: ExpenseDialogProps) {
  const [form, setForm] = useState<ExpenseForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              date: initial.date.slice(0, 10),
              description: initial.description,
              category: initial.category,
              amount: String(initial.amount),
              status: initial.status,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, initial]);

  const set = (field: keyof ExpenseForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.description.trim() || !form.amount.trim()) return;
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);
    try {
      const payload = {
        date: form.date,
        description: form.description.trim(),
        category: form.category,
        amount: parsedAmount,
        status: form.status,
      };
      const saved = initial
        ? await api.put<Expense>(
            `/api/proxy/erp/expenses/${initial.id}`,
            payload,
          )
        : await api.post<Expense>("/api/proxy/erp/expenses", payload);
      onSaved(saved);
      onOpenChange(false);
      toast({ title: initial ? "Expense updated" : "Expense created" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [form, initial, onSaved, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Expense" : "New Expense"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Update expense details."
              : "Record a new business expense."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="e-date">Date *</Label>
              <Input
                id="e-date"
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-amount">Amount *</Label>
              <Input
                id="e-amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="e-description">Description *</Label>
            <Input
              id="e-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Flight to NYC for client meeting"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="e-category">Category</Label>
              <select
                id="e-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-status">Status</Label>
              <select
                id="e-status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {(
                  [
                    "PENDING",
                    "APPROVED",
                    "REJECTED",
                    "REIMBURSED",
                  ] as ExpenseStatus[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !form.description.trim() || !form.amount.trim() || saving
            }
          >
            {saving ? "Saving..." : "Save"}
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
  expense: Expense | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteDialog({ expense, onClose, onDeleted }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await api.delete(`/api/proxy/erp/expenses/${expense.id}`);
      onDeleted(expense.id);
      onClose();
      toast({ title: "Expense deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }, [expense, onDeleted, onClose]);

  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Expense</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>{expense?.description}</strong>? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  useEffect(() => {
    api
      .get<Expense[]>("/api/proxy/erp/expenses")
      .then((res) => setExpenses(Array.isArray(res) ? res : (res as any).data ?? []))
      .catch((err) =>
        toast({
          title: "Failed to load expenses",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = expenses.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      CATEGORY_LABELS[e.category].toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q)
    );
  });

  const handleSaved = useCallback((saved: Expense) => {
    setExpenses((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditTarget(e);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle>Expenses</CardTitle>
            </div>
            <CardDescription>
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} &mdash; Record and categorise business expenses
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Expense
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              {search || statusFilter !== "ALL"
                ? "No expenses match your filters."
                : 'No expenses yet. Click "New Expense" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(expense.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={expense.category} />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(expense)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(expense)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editTarget}
        onSaved={handleSaved}
      />
      <DeleteDialog
        expense={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) =>
          setExpenses((prev) => prev.filter((e) => e.id !== id))
        }
      />
    </div>
  );
}
