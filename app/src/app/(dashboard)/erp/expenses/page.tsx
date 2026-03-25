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
} from "@bemindlabs/unicore-ui";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format-currency";
import { useBusinessTimezone, formatDateTz } from "@/hooks/use-business-timezone";

// ---------------------------------------------------------------------------
// Types — aligned with Prisma ExpenseStatus & ExpenseCategory enums
// ---------------------------------------------------------------------------

type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED";

type ExpenseCategory =
  | "ADVERTISING"
  | "BANK_FEES"
  | "CONSULTING"
  | "DEPRECIATION"
  | "EDUCATION"
  | "EQUIPMENT"
  | "INSURANCE"
  | "LEGAL"
  | "MEALS_ENTERTAINMENT"
  | "OFFICE_SUPPLIES"
  | "PAYROLL"
  | "RENT"
  | "RESEARCH"
  | "SHIPPING"
  | "SOFTWARE"
  | "TAXES"
  | "TRAVEL"
  | "UTILITIES"
  | "OTHER";

interface Expense {
  id: string;
  title: string;
  description?: string;
  category: ExpenseCategory;
  status: ExpenseStatus;
  amount: string | number;
  currency: string;
  expenseDate: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

interface ExpenseForm {
  title: string;
  description: string;
  category: string;
  amount: string;
  paidAt: string;
}

const EMPTY_FORM: ExpenseForm = {
  title: "",
  description: "",
  category: "OTHER",
  amount: "",
  paidAt: new Date().toISOString().slice(0, 10),
};

const CATEGORY_LABELS: Record<string, string> = {
  ADVERTISING: "Advertising",
  BANK_FEES: "Bank Fees",
  CONSULTING: "Consulting",
  DEPRECIATION: "Depreciation",
  EDUCATION: "Education",
  EQUIPMENT: "Equipment",
  INSURANCE: "Insurance",
  LEGAL: "Legal",
  MEALS_ENTERTAINMENT: "Meals",
  OFFICE_SUPPLIES: "Office Supplies",
  PAYROLL: "Payroll",
  RENT: "Rent",
  RESEARCH: "Research",
  SHIPPING: "Shipping",
  SOFTWARE: "Software",
  TAXES: "Taxes",
  TRAVEL: "Travel",
  UTILITIES: "Utilities",
  OTHER: "Other",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS);

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-300",
  SUBMITTED: "bg-yellow-100 text-yellow-800 border-yellow-300",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
  REIMBURSED: "bg-blue-100 text-blue-800 border-blue-300",
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REIMBURSED: "Reimbursed",
};

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  TRAVEL: "bg-sky-100 text-sky-800 border-sky-300",
  OFFICE_SUPPLIES: "bg-zinc-100 text-zinc-800 border-zinc-300",
  SOFTWARE: "bg-violet-100 text-violet-800 border-violet-300",
  ADVERTISING: "bg-pink-100 text-pink-800 border-pink-300",
  MEALS_ENTERTAINMENT: "bg-orange-100 text-orange-800 border-orange-300",
  EQUIPMENT: "bg-teal-100 text-teal-800 border-teal-300",
  CONSULTING: "bg-indigo-100 text-indigo-800 border-indigo-300",
  LEGAL: "bg-amber-100 text-amber-800 border-amber-300",
  INSURANCE: "bg-cyan-100 text-cyan-800 border-cyan-300",
  RENT: "bg-purple-100 text-purple-800 border-purple-300",
  RESEARCH: "bg-lime-100 text-lime-800 border-lime-300",
  TAXES: "bg-rose-100 text-rose-800 border-rose-300",
  UTILITIES: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PAYROLL: "bg-blue-100 text-blue-800 border-blue-300",
  OTHER: "bg-gray-100 text-gray-800 border-gray-300",
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.OTHER;
  const label = CATEGORY_LABELS[category] ?? category;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | ExpenseStatus;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "REIMBURSED", label: "Reimbursed" },
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
              title: initial.title,
              description: initial.description ?? "",
              category: initial.category,
              amount: String(Number(initial.amount) || ""),
              paidAt: initial.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
            }
          : EMPTY_FORM,
      );
    }
  }, [open, initial]);

  const set = (field: keyof ExpenseForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.amount.trim()) return;
    const parsedAmount = parseFloat(form.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        amount: parsedAmount,
        paidAt: form.paidAt || undefined,
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
          <div className="space-y-1">
            <Label htmlFor="e-title">Title *</Label>
            <Input
              id="e-title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="AWS Infrastructure - March"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={form.paidAt}
                onChange={(e) => set("paidAt", e.target.value)}
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
            <Label htmlFor="e-description">Description</Label>
            <Input
              id="e-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional details"
            />
          </div>

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !form.title.trim() || !form.amount.trim() || saving
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
            <strong>{expense?.title}</strong>? This action cannot be
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
// Main Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const tz = useBusinessTimezone();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const query = params.toString() ? `?${params}` : "";
    api
      .get<Expense[]>(`/api/proxy/erp/expenses${query}`)
      .then((res) => setExpenses(Array.isArray(res) ? res : (res as any).data ?? []))
      .catch((err) =>
        toast({
          title: "Failed to load expenses",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = expenses.filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (e.title ?? "").toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      (CATEGORY_LABELS[e.category] ?? "").toLowerCase().includes(q) ||
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
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
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
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTz(expense.expenseDate ?? expense.createdAt, tz)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {expense.title}
                      </TableCell>
                      <TableCell>
                        <CategoryBadge category={expense.category} />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                        {formatCurrency(expense.amount, expense.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={expense.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {expense.status === "DRAFT" && (
                            <>
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
                            </>
                          )}
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
