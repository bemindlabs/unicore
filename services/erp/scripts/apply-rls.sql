-- =============================================================================
-- UniCore ERP — Row-Level Security policies (SaaS phase 4.5)
--
-- Applied AFTER `prisma db push` (db push does not emit RLS). Idempotent.
--
-- Each tenant-scoped table:
--   * ENABLE  ROW LEVEL SECURITY  — turns policies on for non-owners.
--   * FORCE   ROW LEVEL SECURITY  — also enforces them for the table OWNER,
--       which is required because Prisma connects as the owning role
--       (`unicore`). Without FORCE, the owner bypasses every policy and the
--       isolation is silently a no-op.
--   * Policy `tenant_isolation`:
--       USING      (read/update/delete visibility)  tenant_id = app.tenant_id
--       WITH CHECK (insert/update target rows)        tenant_id = app.tenant_id
--
-- `current_setting('app.tenant_id', true)` is read with the missing_ok=true
-- flag; if the GUC is unset it returns NULL and `NULL::uuid = tenant_id` is
-- never true → RLS FAILS CLOSED (zero rows, inserts rejected).
--
-- The PrismaService runs `SET LOCAL app.tenant_id = '<tenant>'` at the start of
-- every request transaction. In self-host that value is always the default
-- tenant, so the policy matches every (default-tenant) row → no-op.
--
-- !!! CRITICAL DEPLOYMENT REQUIREMENT !!!
-- The role in DATABASE_URL MUST be NOSUPERUSER and NOBYPASSRLS. Postgres
-- superusers (and BYPASSRLS roles) ignore EVERY policy, silently turning
-- isolation into a no-op. Verified live in the M2 leak test. Provision once:
--
--   CREATE ROLE unicore_app LOGIN PASSWORD '<secret>' NOSUPERUSER NOBYPASSRLS;
--   GRANT USAGE ON SCHEMA public TO unicore_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unicore_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO unicore_app;
--
-- Then point the ERP service's DATABASE_URL at unicore_app, NOT the bootstrap
-- superuser used for `prisma db push` / this script.
--
-- GAPS #4: the role provisioning below is now real idempotent DDL (was a
-- comment). PrismaService verifies the live role is NOSUPERUSER/NOBYPASSRLS on
-- startup and refuses to boot in production otherwise. The ERP scoped[] array
-- already covers all 15 tenant-bearing tables; the v_* views inherit isolation
-- from their (scoped) base tables, so they need no own policy.
-- =============================================================================

-- ── Provision the application role (NOSUPERUSER / NOBYPASSRLS) ───────────────
-- Idempotent. The password is read from the GUC `unicore.app_password` and is
-- REQUIRED when the role does not yet exist — there is NO placeholder fallback
-- (debt #1, fail closed): a deploy must never silently create a default-password
-- login role. Set it via the canonical deploy wrapper (TODO: full IaC — see
-- scripts/deploy-db.sh):
--   psql -v ON_ERROR_STOP=1 \
--     -c "SET unicore.app_password = '$UNICORE_APP_DB_PASSWORD';" -f apply-rls.sql
-- On the ALTER path (role already exists) the password is left UNCHANGED.
DO $$
DECLARE
  app_pw text := current_setting('unicore.app_password', true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unicore_app') THEN
    -- FAIL CLOSED: refuse to create the login role without an explicit password.
    IF app_pw IS NULL OR app_pw = '' THEN
      RAISE EXCEPTION
        'unicore.app_password is unset/empty: refusing to create role unicore_app with a default password. Set it (e.g. UNICORE_APP_DB_PASSWORD via scripts/deploy-db.sh) and re-run.';
    END IF;
    EXECUTE format(
      'CREATE ROLE unicore_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS INHERIT;',
      app_pw
    );
  ELSE
    -- Password left unchanged on this path (GUC not required).
    EXECUTE 'ALTER ROLE unicore_app NOSUPERUSER NOBYPASSRLS;';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO unicore_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO unicore_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO unicore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO unicore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO unicore_app;

-- ── Tenant-isolation policies ────────────────────────────────────────────────
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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      || 'USING ("tenantId" = current_setting(''app.tenant_id'', true)::uuid) '
      || 'WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true)::uuid);',
      t
    );
  END LOOP;
END $$;
