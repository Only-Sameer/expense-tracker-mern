#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${MONGODB_URI:?Set MONGODB_URI in your shell or a private env file first.}"
command -v mongodump >/dev/null 2>&1 || {
  echo "mongodump is required (MongoDB Database Tools)." >&2
  exit 127
}

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/budgetry-$STAMP.archive.gz"

echo "Creating a compressed Budgetry database dump..."
mongodump --uri "$MONGODB_URI" --archive="$ARCHIVE" --gzip
chmod 600 "$ARCHIVE"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
  chmod 600 "$ARCHIVE.sha256"
fi
echo "Backup created: $ARCHIVE"
echo "Store this file on encrypted storage with restricted access. Do not commit it to Git."
