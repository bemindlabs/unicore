#!/usr/bin/env bash
#
# UniCore — database deploy wrapper (debt #1).
#
# Pushes the Prisma schemas, runs the tenant backfills, and applies the
# Row-Level Security policies for the api-gateway and erp services. It also
# provisions the NOSUPERUSER / NOBYPASSRLS `unicore_app` login role.
#
# FAIL CLOSED: apply-rls.sql refuses to CREATE the unicore_app role without an
# explicit password (no `CHANGE_ME_*` placeholder fallback). This wrapper is the
# single supported entry point for supplying that password, so it REQUIRES
# UNICORE_APP_DB_PASSWORD and errors out if it is unset/empty.
#
# TODO (full IaC out of scope here): this script is the stop-gap deploy path.
#   The eventual goal is to provision the role + RLS from infrastructure-as-code
#   (e.g. a managed-Postgres role module) with the password sourced from the
#   secrets manager rather than an env var passed to psql. Until then, this
#   wrapper is the canonical, fail-closed way to apply RLS. Keep the password
#   requirement here in sync with the RAISE EXCEPTION guard in:
#     services/api-gateway/scripts/apply-rls.sql
#     services/erp/scripts/apply-rls.sql
#
# Usage:
#   UNICORE_APP_DB_PASSWORD='<strong-secret>' \
#   ADMIN_DATABASE_URL='postgresql://owner:pw@host:5432' \
#     scripts/deploy-db.sh
#
# Env:
#   UNICORE_APP_DB_PASSWORD  (required) password for the unicore_app login role.
#   ADMIN_DATABASE_URL       (required) privileged (table-owner/superuser) base
#                            URL WITHOUT a database name; per-service DB names are
#                            appended below. Used for db push + RLS provisioning.
#
set -euo pipefail

# ── Fail closed: the app-role password is mandatory ──────────────────────────
if [ -z "${UNICORE_APP_DB_PASSWORD:-}" ]; then
  echo "ERROR: UNICORE_APP_DB_PASSWORD is unset or empty." >&2
  echo "       apply-rls.sql will not create the unicore_app role without it" >&2
  echo "       (fail-closed; no default-password fallback). Export a strong" >&2
  echo "       secret and re-run, e.g.:" >&2
  echo "         UNICORE_APP_DB_PASSWORD='<strong-secret>' scripts/deploy-db.sh" >&2
  exit 1
fi

if [ -z "${ADMIN_DATABASE_URL:-}" ]; then
  echo "ERROR: ADMIN_DATABASE_URL is unset (privileged base URL, no db name)." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

apply_service() {
  local svc_dir="$1" db_name="$2" backfill="$3"
  local db_url="${ADMIN_DATABASE_URL%/}/${db_name}"

  echo "==> ${svc_dir}: prisma db push -> ${db_name}"
  ( cd "${REPO_ROOT}/${svc_dir}" \
    && DATABASE_URL="${db_url}" pnpm exec prisma db push \
         --schema=src/prisma/schema.prisma --skip-generate --accept-data-loss )

  if [ -n "${backfill}" ] && [ -f "${REPO_ROOT}/${svc_dir}/scripts/${backfill}" ]; then
    echo "==> ${svc_dir}: backfill (${backfill})"
    psql "${db_url}" -v ON_ERROR_STOP=1 -f "${REPO_ROOT}/${svc_dir}/scripts/${backfill}"
  fi

  echo "==> ${svc_dir}: apply-rls.sql (provision unicore_app + RLS)"
  # The password is passed via the GUC, NOT interpolated into the file.
  psql "${db_url}" -v ON_ERROR_STOP=1 \
    -c "SET unicore.app_password = '${UNICORE_APP_DB_PASSWORD}';" \
    -f "${REPO_ROOT}/${svc_dir}/scripts/apply-rls.sql"
}

apply_service "services/api-gateway" "unicore"     "backfill-settings-tenant-key.sql"
apply_service "services/erp"         "unicore_erp" "backfill-tenant.sql"

echo "==> DB deploy complete: schemas pushed, unicore_app provisioned, RLS applied."
