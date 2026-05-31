-- =============================================================================
-- UniCore api-gateway — Settings per-tenant `key` backfill (GAPS #1)
--
-- Maps the legacy global Settings rows (where the PK `id` held a semantic
-- constant such as 'ai-config' / 'default' / 'branding' / 'domains' / 'line' /
-- 'telegram' / 'wizard-status' / 'erp-modules') onto the new per-tenant shape:
--   key       := <old constant id>
--   tenantId  := the row's existing tenantId (DEMO/own tenant; default-zeroed
--                rows map to the DEMO bootstrap tenant)
--   id        := a fresh uuid PK (only when the id is still a non-uuid constant)
--
-- Run order on deploy:
--   1. prisma db push           (adds `key`, @@unique([tenantId, key]))
--   2. THIS script              (backfill, idempotent)
--   3. scripts/apply-rls.sql    (re-assert RLS policies)
--
-- Idempotent: re-running is a no-op once every row has a uuid id + a key that
-- matches its former constant. Safe to run repeatedly.
-- =============================================================================

DO $$
DECLARE
  has_key boolean;
BEGIN
  -- Guard: only run after `key` exists (i.e. after `prisma db push`).
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Settings' AND column_name = 'key'
  ) INTO has_key;

  IF NOT has_key THEN
    RAISE NOTICE 'Settings.key column missing — run `prisma db push` first. Skipping.';
    RETURN;
  END IF;

  -- 1. Adopt the former constant id as the semantic key for legacy rows.
  --    A legacy row is one whose id is NOT a uuid (the old constant ids were
  --    plain strings like 'ai-config'). New rows already have key set.
  UPDATE "Settings"
     SET "key" = "id"
   WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND ("key" IS NULL OR "key" = 'default' OR "key" <> "id");

  -- 2. Replace the non-uuid constant PK with a real uuid, so `id` is opaque.
  --    Guarded by the same non-uuid predicate → idempotent.
  UPDATE "Settings"
     SET "id" = gen_random_uuid()::text
   WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- 3. Any row still carrying the all-zero default tenant keeps it (it maps to
  --    the DEMO bootstrap tenant). Nothing to do — left explicit for clarity.

  RAISE NOTICE 'Settings per-tenant key backfill complete.';
END $$;
