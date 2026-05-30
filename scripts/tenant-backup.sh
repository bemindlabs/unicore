#!/usr/bin/env bash
#
# tenant-backup.sh — per-tenant logical backup / restore / purge (FU-07)
# =============================================================================
#
# UniCore SaaS uses a SHARED database with a `tenant_id` column + Postgres RLS
# (see SAAS-ARCHITECTURE.md §2). A single tenant's data is therefore spread
# across two databases — the api-gateway MAIN DB and the ERP DB — filtered by
# `tenant_id`. This script does a `tenant_id`-filtered logical export of ONE
# tenant across BOTH databases (for offboarding) and can restore or purge it
# (GDPR "right to erasure").
#
# It is DATA-DRIVEN: the tenant-scoped table lists below are derived from the
# Prisma schemas (the 8 gateway + 15 ERP models that carry `tenant_id` in M2).
# When a model gains/loses `tenant_id`, update the arrays here.
#
# -----------------------------------------------------------------------------
# USAGE
# -----------------------------------------------------------------------------
#   scripts/tenant-backup.sh --tenant <TENANT_UUID> [--out <DIR>]            # backup (default)
#   scripts/tenant-backup.sh --tenant <TENANT_UUID> --restore <DIR>         # restore from a backup dir
#   scripts/tenant-backup.sh --tenant <TENANT_UUID> --purge --yes-i-am-sure # GDPR delete
#
# OPTIONS
#   --tenant <uuid>     Tenant id to operate on (REQUIRED).
#   --out <dir>         Output directory for a backup (default: ./tenant-backups/<tenant>-<ts>).
#   --restore <dir>     Restore a previously-created backup directory.
#   --purge             Delete the tenant's rows from BOTH DBs (GDPR). Guarded:
#                       also requires --yes-i-am-sure or interactive confirmation.
#   --yes-i-am-sure     Skip the interactive confirmation for --purge.
#   -h | --help         Show this help.
#
# CONNECTIONS (env, libpq-style URLs; sensible local defaults)
#   GATEWAY_DATABASE_URL   main DB   (default: $DATABASE_URL or postgres on POSTGRES_DB)
#   ERP_DATABASE_URL       ERP DB    (default: same host/creds on POSTGRES_DB_ERP)
#   Honors POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / POSTGRES_DB_ERP and
#   PGHOST / PGPORT when the *_DATABASE_URL vars are not set.
#
# Requires: bash, psql, pg_dump (PostgreSQL client tools).
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Tenant-scoped tables (DERIVED FROM THE PRISMA SCHEMAS — M2 tenant_id columns)
# PascalCase names are quoted because Postgres folds unquoted identifiers to
# lowercase; snake_case names map to Prisma @@map() tables.
# ---------------------------------------------------------------------------

# api-gateway MAIN DB — models carrying tenant_id.
GATEWAY_TABLES=(
  '"User"'
  'custom_domains'
  'audit_logs'
  '"Settings"'
  'tasks'
  'chat_histories'
  'contact_channels'
  'conversations'
)

# ERP DB — models carrying tenant_id.
ERP_TABLES=(
  '"Contact"'
  '"ContactNote"'
  '"Product"'
  '"Warehouse"'
  '"InventoryItem"'
  '"StockMovement"'
  '"Order"'
  '"OrderItem"'
  '"Fulfillment"'
  '"Invoice"'
  '"InvoiceLine"'
  '"Payment"'
  '"Expense"'
  '"Report"'
  '"ReportSnapshot"'
)

# The tenant row itself lives in the gateway DB `tenants` table.
TENANT_ROW_TABLE='tenants'

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
TENANT_ID=""
OUT_DIR=""
MODE="backup"
RESTORE_DIR=""
CONFIRMED="no"

usage() {
  sed -n '2,46p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tenant)        TENANT_ID="${2:-}"; shift 2 ;;
    --out)           OUT_DIR="${2:-}"; shift 2 ;;
    --restore)       MODE="restore"; RESTORE_DIR="${2:-}"; shift 2 ;;
    --purge)         MODE="purge"; shift ;;
    --yes-i-am-sure) CONFIRMED="yes"; shift ;;
    -h|--help)       usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

if [[ -z "$TENANT_ID" ]]; then
  echo "ERROR: --tenant <uuid> is required." >&2
  usage 1
fi

# Refuse to operate on the all-zero self-host default tenant — it is shared.
if [[ "$TENANT_ID" == "00000000-0000-0000-0000-000000000000" ]]; then
  echo "ERROR: refusing to operate on the default (self-host) tenant 00000000-...; this is the shared single tenant." >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Connection URLs (build from POSTGRES_* if *_DATABASE_URL not provided)
# ---------------------------------------------------------------------------
PG_USER="${POSTGRES_USER:-unicore}"
PG_PASS="${POSTGRES_PASSWORD:-}"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_MAIN_DB="${POSTGRES_DB:-unicore}"
PG_ERP_DB="${POSTGRES_DB_ERP:-unicore_erp}"

build_url() { # db
  local cred="$PG_USER"
  [[ -n "$PG_PASS" ]] && cred="$PG_USER:$PG_PASS"
  echo "postgresql://${cred}@${PG_HOST}:${PG_PORT}/$1"
}

GATEWAY_URL="${GATEWAY_DATABASE_URL:-${DATABASE_URL:-$(build_url "$PG_MAIN_DB")}}"
ERP_URL="${ERP_DATABASE_URL:-$(build_url "$PG_ERP_DB")}"

# psql/pg_dump wrappers that fail loudly.
psql_main() { psql "$GATEWAY_URL" -v ON_ERROR_STOP=1 "$@"; }
psql_erp()  { psql "$ERP_URL"  -v ON_ERROR_STOP=1 "$@"; }

# ---------------------------------------------------------------------------
# BACKUP — COPY (SELECT ... WHERE tenant_id = ...) to per-table CSV files.
# ---------------------------------------------------------------------------
backup() {
  local ts; ts="$(date -u +%Y%m%dT%H%M%SZ)"
  local dir="${OUT_DIR:-./tenant-backups/${TENANT_ID}-${ts}}"
  mkdir -p "$dir/gateway" "$dir/erp"

  echo "==> Backing up tenant $TENANT_ID"
  echo "    gateway: $dir/gateway   erp: $dir/erp"

  # Tenant row (gateway DB).
  psql_main -c "\copy (SELECT * FROM ${TENANT_ROW_TABLE} WHERE id = '${TENANT_ID}') TO '${dir}/gateway/__tenant_row.csv' WITH CSV HEADER"

  local t
  for t in "${GATEWAY_TABLES[@]}"; do
    local f; f="$(echo "$t" | tr -d '"')"
    echo "    [gateway] $t"
    psql_main -c "\copy (SELECT * FROM ${t} WHERE tenant_id = '${TENANT_ID}') TO '${dir}/gateway/${f}.csv' WITH CSV HEADER"
  done

  for t in "${ERP_TABLES[@]}"; do
    local f; f="$(echo "$t" | tr -d '"')"
    echo "    [erp] $t"
    psql_erp -c "\copy (SELECT * FROM ${t} WHERE tenant_id = '${TENANT_ID}') TO '${dir}/erp/${f}.csv' WITH CSV HEADER"
  done

  printf '{"tenantId":"%s","createdAt":"%s","gatewayDb":"%s","erpDb":"%s"}\n' \
    "$TENANT_ID" "$ts" "$PG_MAIN_DB" "$PG_ERP_DB" > "$dir/manifest.json"

  echo "==> Backup complete: $dir"
}

# ---------------------------------------------------------------------------
# RESTORE — COPY each CSV back into its table (append). Tables/columns must
# already exist (run prisma db push first). FK order is the array order.
# ---------------------------------------------------------------------------
restore() {
  [[ -d "$RESTORE_DIR" ]] || { echo "ERROR: restore dir not found: $RESTORE_DIR" >&2; exit 2; }
  echo "==> Restoring tenant $TENANT_ID from $RESTORE_DIR"

  if [[ -f "$RESTORE_DIR/gateway/__tenant_row.csv" ]]; then
    psql_main -c "\copy ${TENANT_ROW_TABLE} FROM '${RESTORE_DIR}/gateway/__tenant_row.csv' WITH CSV HEADER"
  fi

  local t f
  for t in "${GATEWAY_TABLES[@]}"; do
    f="$(echo "$t" | tr -d '"')"
    [[ -f "$RESTORE_DIR/gateway/${f}.csv" ]] || continue
    echo "    [gateway] $t"
    psql_main -c "\copy ${t} FROM '${RESTORE_DIR}/gateway/${f}.csv' WITH CSV HEADER"
  done
  for t in "${ERP_TABLES[@]}"; do
    f="$(echo "$t" | tr -d '"')"
    [[ -f "$RESTORE_DIR/erp/${f}.csv" ]] || continue
    echo "    [erp] $t"
    psql_erp -c "\copy ${t} FROM '${RESTORE_DIR}/erp/${f}.csv' WITH CSV HEADER"
  done
  echo "==> Restore complete."
}

# ---------------------------------------------------------------------------
# PURGE — GDPR delete. Guarded by explicit confirmation. Deletes child tables
# first (reverse array order) so FKs don't block, then the tenant row.
# ---------------------------------------------------------------------------
purge() {
  if [[ "$CONFIRMED" != "yes" ]]; then
    echo "!! PURGE will PERMANENTLY DELETE all data for tenant $TENANT_ID across BOTH databases."
    read -r -p "   Type the tenant id to confirm: " typed
    [[ "$typed" == "$TENANT_ID" ]] || { echo "Confirmation mismatch — aborting." >&2; exit 3; }
  fi

  echo "==> Purging tenant $TENANT_ID"

  local i t
  # ERP children first (reverse order).
  for (( i=${#ERP_TABLES[@]}-1; i>=0; i-- )); do
    t="${ERP_TABLES[$i]}"
    echo "    [erp] DELETE $t"
    psql_erp -c "DELETE FROM ${t} WHERE tenant_id = '${TENANT_ID}'"
  done
  for (( i=${#GATEWAY_TABLES[@]}-1; i>=0; i-- )); do
    t="${GATEWAY_TABLES[$i]}"
    echo "    [gateway] DELETE $t"
    psql_main -c "DELETE FROM ${t} WHERE tenant_id = '${TENANT_ID}'"
  done
  # Finally the tenant row.
  psql_main -c "DELETE FROM ${TENANT_ROW_TABLE} WHERE id = '${TENANT_ID}'"

  echo "==> Purge complete for tenant $TENANT_ID."
}

case "$MODE" in
  backup)  backup ;;
  restore) restore ;;
  purge)   purge ;;
  *) echo "Unknown mode: $MODE" >&2; exit 1 ;;
esac
