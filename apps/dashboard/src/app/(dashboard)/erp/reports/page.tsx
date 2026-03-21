"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Package,
  Users,
  ShoppingCart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  toast,
} from "@unicore/ui";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format-currency";
import { useBusinessTimezone } from "@/hooks/use-business-timezone";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardSummary {
  contacts?: { total?: number };
  orders?: { total?: number; pending?: number };
  inventory?: { totalProducts?: number; lowStockCount?: number };
  invoices?: { total?: number; unpaid?: number; totalRevenue?: string | number };
  expenses?: { total?: number; pending?: number; totalAmount?: string | number };
  [key: string]: unknown;
}

interface RevenueData {
  invoices?: number;
  byCurrency?: Record<string, number>;
  [key: string]: unknown;
}

interface InventorySummary {
  totalProducts?: number;
  totalStock?: number;
  lowStock?: number;
  [key: string]: unknown;
}

interface ExpenseCategoryRaw {
  category: string;
  status?: string;
  total?: number | string;
  _sum?: { amount?: string | number };
  _count?: number;
}

interface ExpenseCategory {
  category: string;
  total: number;
}

interface TopProduct {
  name: string;
  sku?: string;
  quantity?: number;
  revenue?: number | string;
  _sum?: { quantity?: number; lineTotal?: string | number };
  _count?: number;
}

interface TopContact {
  name?: string;
  company?: string;
  leadScore?: number;
  totalSpent?: number | string;
  orderCount?: number;
  _count?: { orders?: number; invoices?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = formatCurrency;

const CATEGORY_LABELS: Record<string, string> = {
  ADVERTISING: "Advertising", BANK_FEES: "Bank Fees", CONSULTING: "Consulting",
  DEPRECIATION: "Depreciation", EDUCATION: "Education", EQUIPMENT: "Equipment",
  INSURANCE: "Insurance", LEGAL: "Legal", MEALS_ENTERTAINMENT: "Meals & Entertainment",
  OFFICE_SUPPLIES: "Office Supplies", PAYROLL: "Payroll", RENT: "Rent",
  RESEARCH: "Research", SHIPPING: "Shipping", SOFTWARE: "Software",
  TAXES: "Taxes", TRAVEL: "Travel", UTILITIES: "Utilities", OTHER: "Other",
};

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-4 text-center">{message}</p>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const timezone = useBusinessTimezone();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<
    ExpenseCategory[]
  >([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topContacts, setTopContacts] = useState<TopContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safeFetch = async <T,>(url: string): Promise<T | null> => {
      try {
        const res = await api.get<T>(url);
        return res;
      } catch {
        return null;
      }
    };

    const tzParam = `timezone=${encodeURIComponent(timezone)}`;

    Promise.all([
      safeFetch<DashboardSummary>("/api/proxy/erp/reports/dashboard"),
      safeFetch<RevenueData>(`/api/proxy/erp/reports/revenue?${tzParam}`),
      safeFetch<InventorySummary>("/api/proxy/erp/reports/inventory"),
      safeFetch<ExpenseCategoryRaw[]>(`/api/proxy/erp/reports/expenses/categories?${tzParam}`),
      safeFetch<TopProduct[]>("/api/proxy/erp/reports/products/top"),
      safeFetch<TopContact[]>("/api/proxy/erp/reports/contacts/top"),
    ])
      .then(([dash, rev, inv, exp, prod, cont]) => {
        setDashboard(dash);
        setRevenue(rev);
        setInventory(inv);
        {
          const raw: ExpenseCategoryRaw[] = Array.isArray(exp) ? exp : (exp as any)?.data ?? [];
          // Aggregate by category (API returns per-status rows with _sum.amount)
          const map = new Map<string, number>();
          for (const r of raw) {
            const amt = Number(r._sum?.amount ?? r.total ?? 0);
            map.set(r.category, (map.get(r.category) ?? 0) + amt);
          }
          setExpenseCategories(
            Array.from(map, ([category, total]) => ({ category, total }))
              .sort((a, b) => b.total - a.total),
          );
        }
        setTopProducts(
          Array.isArray(prod) ? prod : (prod as any)?.data ?? [],
        );
        setTopContacts(
          Array.isArray(cont) ? cont : (cont as any)?.data ?? [],
        );
      })
      .catch((err) =>
        toast({
          title: "Failed to load reports",
          description: err.message,
          variant: "destructive",
        }),
      )
      .finally(() => setLoading(false));
  }, [timezone]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        Loading reports…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">ERP Reports</h1>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {dashboard?.invoices?.totalRevenue != null
                ? fmt(dashboard.invoices.totalRevenue)
                : revenue?.byCurrency
                  ? fmt(Object.values(revenue.byCurrency)[0] ?? 0)
                  : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {dashboard?.orders?.total ?? "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {inventory?.totalProducts ?? dashboard?.inventory?.totalProducts ?? "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {dashboard?.contacts?.total ?? "No data yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory details */}
      {inventory && (
        <Card>
          <CardHeader>
            <CardTitle>Inventory Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-xl font-semibold">
                  {inventory.totalProducts ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Stock</p>
                <p className="text-xl font-semibold">
                  {inventory.totalStock ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-xl font-semibold text-orange-600">
                  {inventory.lowStock ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense categories */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <EmptyState message="No data yet" />
            ) : (
              <div className="space-y-3">
                {expenseCategories.map((ec) => (
                  <div
                    key={ec.category}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{CATEGORY_LABELS[ec.category] ?? ec.category}</span>
                    <span className="text-sm font-medium">
                      {fmt(ec.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <EmptyState message="No data yet" />
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{p.name}</span>
                    <span className="text-sm font-medium">
                      {p._sum?.lineTotal != null
                        ? fmt(p._sum.lineTotal)
                        : p.revenue != null
                          ? fmt(p.revenue)
                          : p._sum?.quantity != null
                            ? `${p._sum.quantity} sold`
                            : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Top Contacts</CardTitle>
          </CardHeader>
          <CardContent>
            {topContacts.length === 0 ? (
              <EmptyState message="No data yet" />
            ) : (
              <div className="space-y-3">
                {topContacts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="text-sm">
                      <span>{c.name ?? "Unknown"}</span>
                      {c.company && (
                        <span className="text-muted-foreground ml-1">({c.company})</span>
                      )}
                    </div>
                    <div className="text-sm text-right">
                      {c.totalSpent != null && (
                        <span className="font-medium">{fmt(c.totalSpent)}</span>
                      )}
                      {(c._count?.orders ?? c.orderCount) != null && (
                        <span className="text-muted-foreground ml-2">
                          ({c._count?.orders ?? c.orderCount} orders)
                        </span>
                      )}
                      {c.leadScore != null && !c.totalSpent && !c._count?.orders && (
                        <span className="text-muted-foreground">Score: {c.leadScore}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by currency */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {!revenue?.byCurrency || Object.keys(revenue.byCurrency).length === 0 ? (
              <EmptyState message="No data yet" />
            ) : (
              <div className="space-y-3">
                {Object.entries(revenue.byCurrency).map(([currency, amount]) => (
                  <div
                    key={currency}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">Paid Invoices ({currency})</span>
                    <span className="text-sm font-medium">
                      {fmt(amount, currency)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Total Paid Invoices</span>
                  <span className="text-sm font-medium">{revenue.invoices ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
