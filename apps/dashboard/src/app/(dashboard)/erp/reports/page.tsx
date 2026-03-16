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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardSummary {
  totalRevenue?: number;
  totalOrders?: number;
  totalContacts?: number;
  totalProducts?: number;
  [key: string]: unknown;
}

interface RevenueData {
  total?: number;
  currency?: string;
  byMonth?: { month: string; amount: number }[];
  [key: string]: unknown;
}

interface InventorySummary {
  totalProducts?: number;
  totalStock?: number;
  lowStock?: number;
  [key: string]: unknown;
}

interface ExpenseCategory {
  category: string;
  total: number;
}

interface TopProduct {
  name: string;
  quantity?: number;
  revenue?: number;
}

interface TopContact {
  firstName?: string;
  lastName?: string;
  name?: string;
  totalSpent?: number;
  orderCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground py-4 text-center">{message}</p>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
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

    Promise.all([
      safeFetch<DashboardSummary>("/api/proxy/erp/reports/dashboard"),
      safeFetch<RevenueData>("/api/proxy/erp/reports/revenue"),
      safeFetch<InventorySummary>("/api/proxy/erp/reports/inventory"),
      safeFetch<ExpenseCategory[]>("/api/proxy/erp/reports/expenses/categories"),
      safeFetch<TopProduct[]>("/api/proxy/erp/reports/products/top"),
      safeFetch<TopContact[]>("/api/proxy/erp/reports/contacts/top"),
    ])
      .then(([dash, rev, inv, exp, prod, cont]) => {
        setDashboard(dash);
        setRevenue(rev);
        setInventory(inv);
        setExpenseCategories(
          Array.isArray(exp) ? exp : (exp as any)?.data ?? [],
        );
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
  }, []);

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
              {revenue?.total != null
                ? fmt(revenue.total, revenue.currency)
                : dashboard?.totalRevenue != null
                  ? fmt(dashboard.totalRevenue)
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
              {dashboard?.totalOrders ?? "No data yet"}
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
              {inventory?.totalProducts ?? dashboard?.totalProducts ?? "No data yet"}
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
              {dashboard?.totalContacts ?? "No data yet"}
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
                    <span className="text-sm">{ec.category}</span>
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
                      {p.revenue != null
                        ? fmt(p.revenue)
                        : p.quantity != null
                          ? `${p.quantity} sold`
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
                    <span className="text-sm">
                      {c.name ?? "Unknown"}
                    </span>
                    <div className="text-sm text-right">
                      {c.totalSpent != null && (
                        <span className="font-medium">{fmt(c.totalSpent)}</span>
                      )}
                      {c.orderCount != null && (
                        <span className="text-muted-foreground ml-2">
                          ({c.orderCount} orders)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by month */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Month</CardTitle>
          </CardHeader>
          <CardContent>
            {!revenue?.byMonth || revenue.byMonth.length === 0 ? (
              <EmptyState message="No data yet" />
            ) : (
              <div className="space-y-3">
                {revenue.byMonth.map((m) => (
                  <div
                    key={m.month}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{m.month}</span>
                    <span className="text-sm font-medium">
                      {fmt(m.amount, revenue.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
