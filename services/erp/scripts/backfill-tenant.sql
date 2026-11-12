-- =============================================================================
-- UniCore ERP — Idempotent tenant_id backfill (SaaS phase 4.4)
--
-- Existing rows predate tenancy; the new `tenantId` columns carry a DEFAULT of
-- the all-zero default tenant, so freshly pushed columns are already correct.
-- This script is the explicit, re-runnable belt-and-braces: it rewrites any
-- NULL tenant_id to the default tenant. Safe to run repeatedly.
--
-- Run AFTER `prisma db push`, BEFORE `apply-rls.sql` (so no row is orphaned by
-- the policy). Must run as the table owner / a role with RLS bypass, or with
-- app.tenant_id set to the default tenant.
-- =============================================================================

DO $$
DECLARE
  t text;
  scoped text[] := ARRAY[
    'Contact', 'ContactNote', 'Product', 'Warehouse', 'InventoryItem',
    'StockMovement', 'Order', 'OrderItem', 'Fulfillment', 'Invoice',
    'InvoiceLine', 'Payment', 'Expense', 'Report', 'ReportSnapshot'
  ];
BEGIN
  FOREACH t IN ARRAY scoped LOOP
    EXECUTE format(
      'UPDATE %I SET "tenantId" = ''00000000-0000-0000-0000-000000000000''::uuid '
      || 'WHERE "tenantId" IS NULL;',
      t
    );
  END LOOP;
END $$;
