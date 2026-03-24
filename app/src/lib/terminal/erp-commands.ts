import { api } from '@/lib/api';

// ── ASCII table builder ─────────────────────────────────────────────────────

function table(headers: string[], rows: string[][]): string {
  const cols = headers.length;
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );

  const border = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const headerRow =
    '| ' + headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + ' |';
  const dataRows = rows.map(
    (r) =>
      '| ' +
      Array.from({ length: cols }, (_, i) => (r[i] ?? '').padEnd(widths[i])).join(' | ') +
      ' |'
  );

  return [border, headerRow, border, ...dataRows, border].join('\n');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  return iso.slice(0, 10);
}

function fmtMoney(val?: string | number | null): string {
  if (val === undefined || val === null) return '-';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  return n.toFixed(2);
}

function trunc(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface PagedResponse<T> {
  data?: T[];
  items?: T[];
  total?: number;
  meta?: { total?: number };
}

interface Contact {
  id: string;
  name: string;
  email: string;
  type: string;
  company?: string;
  phone?: string;
  leadScore?: number;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  contact?: { name: string };
  currency: string;
  total: number | string;
  createdAt: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  quantity: number;
  lowStockThreshold?: number;
  unitPrice: number;
  currency?: string;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  status: string;
  contact?: { name: string; email?: string };
  currency: string;
  total: string | number;
  amountDue?: string | number;
  dueDate?: string;
  createdAt: string;
  notes?: string;
}

interface RevenueData {
  invoices?: number;
  byCurrency?: Record<string, number>;
  [key: string]: unknown;
}

interface PnlRow {
  month?: string;
  year?: number;
  revenue?: number | string;
  expenses?: number | string;
  profit?: number | string;
  [key: string]: unknown;
}

// ── Command handlers ────────────────────────────────────────────────────────

export async function erpContacts(search?: string): Promise<string> {
  const qs = new URLSearchParams({ page: '1', limit: '20' });
  if (search) qs.set('search', search);

  const res = await api.get<PagedResponse<Contact>>(
    `/api/proxy/erp/contacts?${qs}`
  );
  const items: Contact[] = res.data ?? res.items ?? (res as unknown as Contact[]);
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) return 'No contacts found.';

  const rows = list.map((c) => [
    trunc(c.name, 25),
    trunc(c.email, 30),
    c.type,
    trunc(c.company ?? '-', 20),
    c.phone ?? '-',
    String(c.leadScore ?? '-'),
  ]);

  const header = `Contacts${search ? ` (search: "${search}")` : ''} — ${list.length} result(s)`;
  return header + '\n' + table(['Name', 'Email', 'Type', 'Company', 'Phone', 'Score'], rows);
}

export async function erpOrders(status?: string): Promise<string> {
  const qs = new URLSearchParams({ page: '1', limit: '20' });
  if (status) qs.set('status', status.toUpperCase());

  const res = await api.get<PagedResponse<Order>>(`/api/proxy/erp/orders?${qs}`);
  const items: Order[] = res.data ?? res.items ?? (res as unknown as Order[]);
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0)
    return status ? `No orders with status "${status.toUpperCase()}".` : 'No orders found.';

  const rows = list.map((o) => [
    o.orderNumber ?? o.id.slice(0, 8),
    o.status,
    trunc(o.contact?.name ?? '-', 22),
    o.currency,
    fmtMoney(o.total),
    fmtDate(o.createdAt),
  ]);

  const header = `Orders${status ? ` [${status.toUpperCase()}]` : ''} — ${list.length} result(s)`;
  return header + '\n' + table(['#', 'Status', 'Contact', 'Ccy', 'Total', 'Date'], rows);
}

export async function erpInventory(): Promise<string> {
  const res = await api.get<PagedResponse<Product>>(`/api/proxy/erp/inventory?page=1&limit=50`);
  const items: Product[] = res.data ?? res.items ?? (res as unknown as Product[]);
  const list = Array.isArray(items) ? items : [];

  if (list.length === 0) return 'No inventory items found.';

  const rows = list.map((p) => {
    const threshold = p.lowStockThreshold ?? 5;
    const low = p.quantity <= threshold;
    const flag = low ? '!LOW' : 'OK';
    return [
      p.sku,
      trunc(p.name, 28),
      trunc(p.category ?? '-', 14),
      String(p.quantity),
      String(threshold),
      fmtMoney(p.unitPrice),
      flag,
    ];
  });

  const lowCount = list.filter((p) => p.quantity <= (p.lowStockThreshold ?? 5)).length;
  const header = `Inventory — ${list.length} item(s)${lowCount > 0 ? `, ${lowCount} LOW STOCK` : ''}`;
  return header + '\n' + table(['SKU', 'Name', 'Category', 'Qty', 'Min', 'Price', 'Stock'], rows);
}

export async function erpRevenue(period?: string): Promise<string> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await api.get<RevenueData>(
    `/api/proxy/erp/reports/revenue?timezone=${encodeURIComponent(tz)}`
  );

  const lines: string[] = [];
  lines.push(`Revenue Summary${period ? ` [${period}]` : ''}`);
  lines.push('');

  if (res.invoices !== undefined) {
    lines.push(`  Total Invoiced : ${fmtMoney(res.invoices)}`);
  }

  if (res.byCurrency && Object.keys(res.byCurrency).length > 0) {
    lines.push('');
    lines.push('  By Currency:');
    const rows = Object.entries(res.byCurrency).map(([ccy, amt]) => [ccy, fmtMoney(amt)]);
    lines.push(table(['Currency', 'Amount'], rows));
  }

  // Also fetch dashboard summary for more context
  try {
    const dash = await api.get<{
      invoices?: { total?: number; unpaid?: number; totalRevenue?: string | number };
      orders?: { total?: number; pending?: number };
    }>('/api/proxy/erp/reports/dashboard');

    if (dash.invoices) {
      lines.push('');
      lines.push('  Invoice Stats:');
      lines.push(`    Total invoices : ${dash.invoices.total ?? '-'}`);
      lines.push(`    Unpaid         : ${dash.invoices.unpaid ?? '-'}`);
      lines.push(`    Total Revenue  : ${fmtMoney(dash.invoices.totalRevenue)}`);
    }
    if (dash.orders) {
      lines.push('');
      lines.push('  Order Stats:');
      lines.push(`    Total orders   : ${dash.orders.total ?? '-'}`);
      lines.push(`    Pending        : ${dash.orders.pending ?? '-'}`);
    }
  } catch {
    // dashboard summary is optional
  }

  return lines.join('\n');
}

export async function erpInvoice(id: string): Promise<string> {
  const inv = await api.get<Invoice>(`/api/proxy/erp/invoices/${id}`);

  const lines: string[] = [];
  lines.push(`Invoice Detail`);
  lines.push('+' + '-'.repeat(38) + '+');
  lines.push(`| Invoice #  : ${(inv.invoiceNumber ?? inv.id).padEnd(24)} |`);
  lines.push(`| Status     : ${inv.status.padEnd(24)} |`);
  lines.push(`| Contact    : ${trunc(inv.contact?.name ?? '-', 24).padEnd(24)} |`);
  lines.push(`| Email      : ${trunc(inv.contact?.email ?? '-', 24).padEnd(24)} |`);
  lines.push(`| Currency   : ${inv.currency.padEnd(24)} |`);
  lines.push(`| Total      : ${fmtMoney(inv.total).padEnd(24)} |`);
  lines.push(`| Amount Due : ${fmtMoney(inv.amountDue).padEnd(24)} |`);
  lines.push(`| Due Date   : ${fmtDate(inv.dueDate).padEnd(24)} |`);
  lines.push(`| Created    : ${fmtDate(inv.createdAt).padEnd(24)} |`);
  if (inv.notes) {
    lines.push(`| Notes      : ${trunc(inv.notes, 24).padEnd(24)} |`);
  }
  lines.push('+' + '-'.repeat(38) + '+');

  return lines.join('\n');
}

export async function erpReportPnl(): Promise<string> {
  // Try the P&L endpoint first, fall back to dashboard summary
  let rows: string[][] = [];
  let fetched = false;

  try {
    const res = await api.get<PnlRow[] | { data?: PnlRow[] }>('/api/proxy/erp/reports/pnl');
    const list: PnlRow[] = Array.isArray(res) ? res : (res as { data?: PnlRow[] }).data ?? [];
    if (list.length > 0) {
      rows = list.map((r) => [
        r.month ? String(r.month) : '-',
        fmtMoney(r.revenue),
        fmtMoney(r.expenses),
        fmtMoney(r.profit),
      ]);
      fetched = true;
    }
  } catch {
    // endpoint may not exist — fall through
  }

  if (!fetched) {
    // Fallback: compose from dashboard summary
    try {
      const dash = await api.get<{
        invoices?: { totalRevenue?: string | number };
        expenses?: { totalAmount?: string | number };
      }>('/api/proxy/erp/reports/dashboard');

      const rev = parseFloat(String(dash.invoices?.totalRevenue ?? 0)) || 0;
      const exp = parseFloat(String(dash.expenses?.totalAmount ?? 0)) || 0;
      const profit = rev - exp;

      rows = [['(current)', fmtMoney(rev), fmtMoney(exp), fmtMoney(profit)]];
    } catch {
      return 'Failed to fetch P&L data.';
    }
  }

  const header = 'P&L Report (Monthly)';
  return header + '\n' + table(['Month', 'Revenue', 'Expenses', 'Profit'], rows);
}

// ── Top-level dispatcher ────────────────────────────────────────────────────

export async function handleErpCommand(args: string[]): Promise<string> {
  const sub = args[0]?.toLowerCase();

  switch (sub) {
    case 'contacts':
      return erpContacts(args[1]);

    case 'orders':
      return erpOrders(args[1]);

    case 'inventory':
      return erpInventory();

    case 'revenue':
      return erpRevenue(args[1]);

    case 'invoice': {
      const id = args[1];
      if (!id) return 'Usage: /erp invoice <id>';
      return erpInvoice(id);
    }

    case 'report': {
      const sub2 = args[1]?.toLowerCase();
      if (sub2 === 'pnl') return erpReportPnl();
      return `Unknown report: "${args[1]}". Available: pnl`;
    }

    default:
      return [
        'ERP Commands:',
        '  /erp contacts [search]     — list contacts (optional search term)',
        '  /erp orders [status]       — list orders (optional status filter)',
        '  /erp inventory             — stock levels with low-stock flags',
        '  /erp revenue [period]      — revenue summary',
        '  /erp invoice <id>          — invoice detail by ID',
        '  /erp report pnl            — P&L monthly report',
      ].join('\n');
  }
}
