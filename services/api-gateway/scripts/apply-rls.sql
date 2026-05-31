-- =============================================================================
-- UniCore api-gateway — Row-Level Security policies (SaaS phase 4.5 / GAPS #4/#5)
--
-- Applied AFTER `prisma db push` (db push does not emit RLS). Idempotent — safe
-- to re-run. Run as the bootstrap superuser (the role that owns the tables);
-- the application then connects as the NOSUPERUSER role provisioned below.
--
-- !!! CRITICAL DEPLOYMENT REQUIREMENT (GAPS #4) !!!
-- The role in DATABASE_URL MUST be NOSUPERUSER and NOBYPASSRLS. Postgres
-- superusers (and BYPASSRLS roles) ignore EVERY policy, silently turning tenant
-- isolation into a no-op. PrismaService now verifies this live on startup and
-- refuses to boot in production if the role can bypass RLS.
--
-- Tenant-scoped tables use @@map names, so the physical table names differ from
-- the Prisma model names:
--   Settings        -> "Settings"        (no @@map)
--   Membership      -> "memberships"
--   Task            -> "tasks"
--   ChatHistory     -> "chat_histories"
--   Conversation    -> "conversations"
--   ContactChannel  -> "contact_channels"
--   AuditLog        -> "audit_logs"
--
-- Column-type note: the @db.Uuid tenant columns compare against
-- current_setting('app.tenant_id')::uuid. "memberships".tenantId is a TEXT
-- column (FK to tenants.id, also text), so its policy compares TEXT-to-TEXT —
-- casting to uuid would error/mismatch.
--
-- Exempt (deliberately NOT tenant-scoped — verified against schema.prisma):
--   User/Session/OAuthAccount  — global identity; User already carries tenantId.
--   Tenant                     — the tenant boundary itself.
--   CustomDomain               — tenant-keyed but routing-layer, read before auth.
--   ChatMessage                — OpenClaw agent bus; keyed by channel, no tenantId column.
--   ConversationMessage/Message/ConversationParticipant
--                              — child rows of Conversation; isolated transitively
--                                via the parent Conversation (which IS scoped) — no
--                                own tenantId column to filter on.
--   AgentNote                  — keyed by contactId/authorId, no tenantId column.
--   ChannelMessage             — normalized inbound bus; keyed by (channel, externalId),
--                                no tenantId column.
--   Notification               — keyed by userId (per-user, FK cascade), no tenantId.
--   Handoff                    — keyed by userId/channel, no tenantId column.
--   CannedResponse             — global shortcuts (unique by shortcut), no tenantId.
--   Gamification               — per-user (userId unique), no tenantId column.
--   Plugin/PluginVersion/PluginInstallation — global marketplace registry.
-- Any of these that later gains a tenantId MUST be moved into the scoped[] array.
-- =============================================================================

-- ── 1. Provision the application role (NOSUPERUSER / NOBYPASSRLS) ────────────
-- Idempotent: created only if absent, then (re)granted the table DML it needs.
-- Password is read from the PSQL variable :app_password if provided, else a
-- placeholder is used and MUST be reset out-of-band before the role logs in:
--   psql -v app_password="$UNICORE_APP_DB_PASSWORD" -f apply-rls.sql
DO $$
DECLARE
  app_pw text := COALESCE(
    current_setting('unicore.app_password', true),
    'CHANGE_ME_unicore_app'
  );
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unicore_app') THEN
    EXECUTE format(
      'CREATE ROLE unicore_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS INHERIT;',
      app_pw
    );
  ELSE
    -- Ensure an existing role can never bypass RLS, even if altered elsewhere.
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

-- ── 2. Tenant-isolation policies for @db.Uuid-typed tenant columns ───────────
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

-- ── 3. memberships — TEXT tenantId (compare text-to-text, no ::uuid cast) ────
-- GAPS #5: memberships carries tenantId but had no policy, so any tenant could
-- read/forge another tenant's membership rows. Added here.
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "memberships";
CREATE POLICY tenant_isolation ON "memberships"
  USING      ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
