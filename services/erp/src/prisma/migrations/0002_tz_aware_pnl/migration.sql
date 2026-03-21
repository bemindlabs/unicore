-- =============================================================================
-- Migration: 0002_tz_aware_pnl
-- Adds a timezone-aware P&L function that wraps the same logic as v_pnl_monthly
-- but applies AT TIME ZONE for correct monthly bucketing per business timezone.
-- The original v_pnl_monthly view is kept for backward compatibility.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- fn_pnl_monthly(tz TEXT)
-- Returns monthly P&L with date_trunc applied in the given IANA timezone.
-- Usage: SELECT * FROM fn_pnl_monthly('Asia/Bangkok');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pnl_monthly(tz TEXT DEFAULT 'UTC')
RETURNS TABLE (
  month        TEXT,
  currency     CHAR(3),
  "totalRevenue"  NUMERIC,
  "totalExpenses" NUMERIC,
  "grossProfit"   NUMERIC
)
LANGUAGE sql STABLE
AS $$
  WITH revenue AS (
    SELECT
      to_char(date_trunc('month', "paidAt" AT TIME ZONE tz), 'YYYY-MM') AS month,
      currency,
      COALESCE(SUM(total), 0) AS total_revenue
    FROM "Invoice"
    WHERE status = 'PAID'
      AND "paidAt" IS NOT NULL
    GROUP BY 1, 2
  ),
  expenses AS (
    SELECT
      to_char(date_trunc('month', "expenseDate" AT TIME ZONE tz), 'YYYY-MM') AS month,
      currency,
      COALESCE(SUM(COALESCE("baseAmount", amount)), 0) AS total_expenses
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
    COALESCE(r.total_revenue,  0)                                  AS "totalRevenue",
    COALESCE(e.total_expenses, 0)                                  AS "totalExpenses",
    COALESCE(r.total_revenue,  0) - COALESCE(e.total_expenses, 0)  AS "grossProfit"
  FROM months m
  LEFT JOIN revenue  r ON r.month = m.month AND r.currency = m.currency
  LEFT JOIN expenses e ON e.month = m.month AND e.currency = m.currency
  ORDER BY m.month DESC, m.currency;
$$;
