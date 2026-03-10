-- =============================================================================
-- Migration: 0001_erp_views
-- Creates the three PostgreSQL views used for P&L, AR aging, and low-stock.
-- These are read by Prisma via the "views" previewFeature.
-- Run after the main Prisma migration that creates the base tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- v_pnl_monthly
-- Monthly P&L: paid invoice revenue vs approved expense costs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_pnl_monthly AS
WITH revenue AS (
  SELECT
    to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS month,
    currency,
    COALESCE(SUM(total), 0)                           AS total_revenue
  FROM "Invoice"
  WHERE status = 'PAID'
    AND "paidAt" IS NOT NULL
  GROUP BY 1, 2
),
expenses AS (
  SELECT
    to_char(date_trunc('month', "expenseDate"), 'YYYY-MM') AS month,
    currency,
    COALESCE(SUM(COALESCE("baseAmount", amount)), 0)       AS total_expenses
  FROM "Expense"
  WHERE status = 'APPROVED'
  GROUP BY 1, 2
),
months AS (
  SELECT month, currency FROM revenue
  UNION
  SELECT month, currency FROM expenses
)
SELECT
  m.month,
  m.currency,
  COALESCE(r.total_revenue,  0)                                AS "totalRevenue",
  COALESCE(e.total_expenses, 0)                                AS "totalExpenses",
  COALESCE(r.total_revenue,  0) - COALESCE(e.total_expenses, 0) AS "grossProfit"
FROM months m
LEFT JOIN revenue  r ON r.month = m.month AND r.currency = m.currency
LEFT JOIN expenses e ON e.month = m.month AND e.currency = m.currency
ORDER BY m.month DESC, m.currency;

-- ---------------------------------------------------------------------------
-- v_ar_aging
-- Accounts-receivable aging: outstanding invoices bucketed by days overdue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ar_aging AS
SELECT
  i.id                                             AS id,
  i."invoiceNumber"                                AS "invoiceNumber",
  COALESCE(c.name, 'Unknown')                      AS "contactName",
  i.total                                          AS total,
  i."amountDue"                                    AS "amountDue",
  GREATEST(
    0,
    EXTRACT(DAY FROM (now() - i."dueDate"))::INT
  )                                                AS "daysOverdue",
  CASE
    WHEN now() <= i."dueDate"
      THEN 'current'
    WHEN EXTRACT(DAY FROM (now() - i."dueDate")) <= 30
      THEN '1-30'
    WHEN EXTRACT(DAY FROM (now() - i."dueDate")) <= 60
      THEN '31-60'
    WHEN EXTRACT(DAY FROM (now() - i."dueDate")) <= 90
      THEN '61-90'
    ELSE '90+'
  END                                              AS "agingBucket"
FROM "Invoice" i
LEFT JOIN "Contact" c ON c.id = i."contactId"
WHERE i."amountDue" > 0
  AND i.status NOT IN ('VOID', 'WRITTEN_OFF', 'DRAFT');

-- ---------------------------------------------------------------------------
-- v_low_stock_alert
-- Products whose quantityAvailable is at or below their reorderPoint.
-- Polled by the Kafka inventory.low event publisher.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_low_stock_alert AS
SELECT
  inv.id                  AS id,
  p.sku                   AS sku,
  p.name                  AS "productName",
  w.name                  AS "warehouseName",
  inv."quantityAvailable" AS "quantityAvailable",
  inv."reorderPoint"      AS "reorderPoint",
  inv."reorderQty"        AS "reorderQty"
FROM "InventoryItem" inv
JOIN "Product"   p ON p.id = inv."productId"
JOIN "Warehouse" w ON w.id = inv."warehouseId"
WHERE inv."quantityAvailable" <= inv."reorderPoint"
  AND p."isActive"  = TRUE
  AND w.status = 'ACTIVE';
