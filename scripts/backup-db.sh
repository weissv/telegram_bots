#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Backup Script (supports DATABASE_URL or running Docker container)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

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

BACKUP_FILE="${BACKUP_DIR}/telegram_commerce_${TIMESTAMP}.sql.gz"
TMP_FILE="${BACKUP_FILE}.tmp"
trap 'rm -f "$TMP_FILE"' EXIT

if [ -n "${DATABASE_URL:-}" ]; then
  echo "📦 Backing up database via DATABASE_URL..."
  pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$TMP_FILE"
elif [ -n "$PG_CONTAINER" ]; then
  PG_USER="${PG_USER:-${POSTGRES_USER:-postgres}}"
  PG_DB="${PG_DB:-${POSTGRES_DB:-telegram_commerce}}"
  echo "📦 Backing up database from Docker container '$PG_CONTAINER' (db: $PG_DB)..."
  docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" --no-owner --no-acl "$PG_DB" | gzip -9 > "$TMP_FILE"
else
  echo "❌ Error: Set DATABASE_URL or PG_CONTAINER (or start tg_commerce_postgres / standalone_postgres)." >&2
  exit 1
fi

if [ ! -s "$TMP_FILE" ]; then
  echo "❌ Error: Backup file is empty!" >&2
  exit 1
fi

gzip -t "$TMP_FILE"
mv "$TMP_FILE" "$BACKUP_FILE"

FILE_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
echo "✅ Backup verified and saved: $BACKUP_FILE (${FILE_SIZE} bytes)"
