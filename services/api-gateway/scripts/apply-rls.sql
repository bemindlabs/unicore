-- =============================================================================
-- UniCore api-gateway — Row-Level Security policies (SaaS phase 4.5)
--
-- Applied AFTER `prisma db push`. Idempotent. See the ERP companion
-- (services/erp/scripts/apply-rls.sql) for the FORCE / fail-closed rationale
-- and the CRITICAL requirement that DATABASE_URL use a NOSUPERUSER /
-- NOBYPASSRLS role (superusers bypass every policy).
--
-- Tenant-scoped tables in the gateway schema use @@map names, so the physical
-- table names differ from the Prisma model names:
--   Settings        -> "Settings"        (no @@map)
--   Task            -> "tasks"
--   ChatHistory     -> "chat_histories"
--   Conversation    -> "conversations"
--   ContactChannel  -> "contact_channels"
--   AuditLog        -> "audit_logs"
--
-- Skipped (deliberately): User/Session/OAuthAccount (global identity, scoped to
-- a user; User already carries tenantId for its own filtering), Tenant (the
-- boundary itself), CustomDomain (already tenant-keyed but routing-layer, read
-- before auth). See SAAS-ARCHITECTURE.md §2.
-- =============================================================================

DO $$
DECLARE
  t text;
  scoped text[] := ARRAY[
    'Settings', 'tasks', 'chat_histories', 'conversations',
    'contact_channels', 'audit_logs'
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
