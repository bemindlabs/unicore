"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
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

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  currency?: string;
}

interface ProductForm {
  sku: string;
  name: string;
  category: string;
  unitPrice: string;
  costPrice: string;
  quantity: string;
  lowStockThreshold: string;
}

const EMPTY_FORM: ProductForm = {
  sku: "",
  name: "",
  category: "",
  unitPrice: "",
  costPrice: "",
  quantity: "0",
  lowStockThreshold: "5",
};

// ---------------------------------------------------------------------------
// Product Dialog (create / edit)
// ---------------------------------------------------------------------------

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Product | null;
  onSaved: (product: Product) => void;
}

function ProductDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: ProductDialogProps) {
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              sku: initial.sku,
              name: initial.name,
              category: initial.category ?? "",
              unitPrice: String(initial.unitPrice),
              costPrice: String(initial.costPrice ?? ""),
              quantity: String(initial.quantity),
              lowStockThreshold: String(initial.lowStockThreshold ?? 5),
            }
          : EMPTY_FORM,
      );
    }
  }, [open, initial]);

  const set = (field: keyof ProductForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = useCallback(async () => {
    if (!form.sku.trim() || !form.name.trim() || !form.unitPrice) return;
    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        ...(form.category.trim() && { category: form.category.trim() }),
        unitPrice: parseFloat(form.unitPrice),
        ...(form.costPrice && { costPrice: parseFloat(form.costPrice) }),
        quantity: parseInt(form.quantity, 10) || 0,
        lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 5,
      };
      const saved = initial
        ? await api.put<Product>(
            `/api/proxy/erp/inventory/${initial.id}`,
            payload,
          )
        : await api.post<Product>("/api/proxy/erp/inventory", payload);
      onSaved(saved);
      onOpenChange(false);
      toast({ title: initial ? "Product updated" : "Product created" });
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

  const isValid = form.sku.trim() && form.name.trim() && form.unitPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Product" : "New Product"}</DialogTitle>
          <DialogDescription>
            {initial
              ? "Update product details."
              : "Add a new product to inventory."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p-sku">SKU *</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="SKU-001"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Electronics"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="p-name">Name *</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Product name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p-price">Unit Price *</Label>
              <Input
                id="p-price"
                type="number"
                step="0.01"
                min="0"
                value={form.unitPrice}
                onChange={(e) => set("unitPrice", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-cost">Cost Price</Label>
              <Input
                id="p-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => set("costPrice", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p-qty">Quantity</Label>
              <Input
                id="p-qty"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-low">Low Stock Threshold</Label>
              <Input
                id="p-low"
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => set("lowStockThreshold", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Adjust Stock Dialog
// ---------------------------------------------------------------------------

interface AdjustStockDialogProps {
  product: Product | null;
  onClose: () => void;
  onAdjusted: (product: Product) => void;
}

function AdjustStockDialog({
  product,
  onClose,
  onAdjusted,
}: AdjustStockDialogProps) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setDelta("");
      setReason("");
    }
  }, [product]);

  const handleAdjust = useCallback(async () => {
    if (!product || !delta) return;
    setSaving(true);
    try {
      const updated = await api.post<Product>(
        `/api/proxy/erp/inventory/${product.id}/adjust-stock`,
        {
          delta: parseInt(delta, 10),
          reason: reason.trim() || "Manual adjustment",
        },
      );
      onAdjusted(updated);
      onClose();
      toast({ title: "Stock adjusted" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [product, delta, reason, onAdjusted, onClose]);

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Adjust stock for <strong>{product?.name}</strong>. Current:{" "}
            {product?.quantity ?? 0} units.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="adj-delta">Delta (+ add / - remove)</Label>
            <Input
              id="adj-delta"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Recount, return, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdjust} disabled={!delta || saving}>
            {saving ? "Saving…" : "Adjust"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation
// ---------------------------------------------------------------------------

interface DeleteProductDialogProps {
  product: Product | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteProductDialog({
  product,
  onClose,
  onDeleted,
}: DeleteProductDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!product) return;
    setDeleting(true);
    try {
      await api.delete(`/api/proxy/erp/inventory/${product.id}`);
      onDeleted(product.id);
      onClose();
      toast({ title: "Product deleted" });
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  }, [product, onDeleted, onClose]);

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{product?.name}</strong>?
            This action cannot be undone.
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
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  useEffect(() => {
    const query = lowStockOnly ? "?lowStock=true" : "";
    api
      .get<Product[]>(`/api/proxy/erp/inventory${query}`)
      .then((res) => setProducts(Array.isArray(res) ? res : (res as any).data ?? []))
      .catch((err) =>
        toast({
          title: "Failed to load inventory",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [lowStockOnly]);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category ?? "").toLowerCase().includes(q)
    );
  });

  const handleSaved = useCallback((saved: Product) => {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
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
  const openEdit = (p: Product) => {
    setEditTarget(p);
    setDialogOpen(true);
  };

  const isLow = (p: Product) => p.quantity <= (p.lowStockThreshold ?? 5);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle>Inventory</CardTitle>
            </div>
            <CardDescription>
              {products.length} product{products.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setLowStockOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                lowStockOnly
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-muted text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              <AlertTriangle className="h-3 w-3" />
              Low Stock
            </button>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
              {search || lowStockOnly
                ? "No products match your filters."
                : 'No products yet. Click "New Product" to get started.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">
                        {product.sku}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmt(product.unitPrice)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-medium ${isLow(product) ? "text-amber-600" : ""}`}
                          >
                            {product.quantity}
                          </span>
                          {isLow(product) && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjustTarget(product)}
                          >
                            Adjust
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(product)}
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

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editTarget}
        onSaved={handleSaved}
      />
      <AdjustStockDialog
        product={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={(p) =>
          setProducts((prev) => prev.map((x) => (x.id === p.id ? p : x)))
        }
      />
      <DeleteProductDialog
        product={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) =>
          setProducts((prev) => prev.filter((p) => p.id !== id))
        }
      />
    </div>
  );
}
