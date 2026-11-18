#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Verified Restore Script
# Usage: ./scripts/restore-db.sh <backup_file.sql.gz> --yes
# ==============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup_file.sql.gz|.sql> [--yes]" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONFIRMED="false"
if [ "${2:-}" = "--yes" ] || [ "${2:-}" = "-y" ]; then
  CONFIRMED="true"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [ ! -s "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file is empty: $BACKUP_FILE" >&2
  exit 1
fi

if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "🔍 Verifying gzip archive integrity..."
  gzip -t "$BACKUP_FILE"
fi

if [ "$CONFIRMED" != "true" ]; then
  if [ -t 0 ]; then
    read -rp "⚠️  This will overwrite data in the target database. Type 'RESTORE' to continue: " ANSWER
    if [ "$ANSWER" != "RESTORE" ]; then
      echo "Aborted."
      exit 1
    fi
  else
    echo "❌ Error: Non-interactive restore requires explicit --yes flag." >&2
    exit 1
  fi
fi

PG_CONTAINER="${PG_CONTAINER:-}"
if [ -z "$PG_CONTAINER" ] && command -v docker >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^tg_commerce_postgres$'; then
    PG_CONTAINER="tg_commerce_postgres"
    PG_USER="${POSTGRES_USER:-postgres}"
    PG_DB="${POSTGRES_DB:-telegram_commerce}"
  elif docker ps --format '{{.Names}}' | grep -q '^standalone_postgres$'; then
    PG_CONTAINER="standalone_postgres"
    PG_USER="${POSTGRES_USER:-standalone_user}"
    PG_DB="${POSTGRES_DB:-telegram_commerce_standalone}"
  fi
fi

run_sql_restore() {
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE"
  else
    cat "$BACKUP_FILE"
  fi
}

if [ -n "${DATABASE_URL:-}" ]; then
  echo "🔄 Restoring into DATABASE_URL from $BACKUP_FILE..."
  run_sql_restore | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
elif [ -n "$PG_CONTAINER" ]; then
  PG_USER="${PG_USER:-${POSTGRES_USER:-postgres}}"
  PG_DB="${PG_DB:-${POSTGRES_DB:-telegram_commerce}}"
  echo "🔄 Restoring into Docker container '$PG_CONTAINER' (db: $PG_DB) from $BACKUP_FILE..."
  run_sql_restore | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1
else
  echo "❌ Error: Set DATABASE_URL or PG_CONTAINER (or start tg_commerce_postgres / standalone_postgres)." >&2
  exit 1
fi

echo "✅ Database restore completed successfully."
