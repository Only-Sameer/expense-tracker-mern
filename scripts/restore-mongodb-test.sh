#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ARCHIVE="${1:-}"
: "${RESTORE_URI:?Set RESTORE_URI to a separate test/restore MongoDB deployment.}"
: "${CONFIRM_RESTORE_TEST:?Set CONFIRM_RESTORE_TEST=YES to confirm restoring into the isolated restore-test database.}"
if [[ "$CONFIRM_RESTORE_TEST" != "YES" ]]; then
  echo "Refusing restore: set CONFIRM_RESTORE_TEST=YES only after verifying RESTORE_URI." >&2
  exit 2
fi
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: RESTORE_URI=... CONFIRM_RESTORE_TEST=YES ./scripts/restore-mongodb-test.sh ./backups/file.archive.gz" >&2
  exit 2
fi
command -v mongorestore >/dev/null 2>&1 || {
  echo "mongorestore is required (MongoDB Database Tools)." >&2
  exit 127
}
command -v mongosh >/dev/null 2>&1 || {
  echo "mongosh is required for the post-restore collection-count check." >&2
  exit 127
}

echo "Restoring only into budgetry_restore_test.* on the explicitly supplied restore target..."
mongorestore \
  --uri "$RESTORE_URI" \
  --archive="$ARCHIVE" \
  --gzip \
  --nsFrom='expense_tracker.*' \
  --nsTo='budgetry_restore_test.*' \
  --drop

mongosh "$RESTORE_URI" --quiet --eval '
  const restored = db.getSiblingDB("budgetry_restore_test");
  const collections = restored.getCollectionNames();
  if (!collections.length) {
    print("Restore verification failed: no collections found.");
    quit(3);
  }
  for (const name of collections) {
    print(name + ": " + restored.getCollection(name).countDocuments({}));
  }
  print("Restore verification passed: collections are readable in the isolated test database.");
'
