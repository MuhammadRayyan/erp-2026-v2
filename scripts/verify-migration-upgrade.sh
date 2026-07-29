#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_SHA:-}" ]; then
  echo "BASE_SHA is required." >&2
  exit 1
fi

if [ -z "${UPGRADE_DATABASE_URL:-}" ]; then
  echo "UPGRADE_DATABASE_URL is required." >&2
  exit 1
fi

root_dir="$(git rev-parse --show-toplevel)"
base_dir="$(mktemp -d)"

cleanup() {
  git -C "$root_dir" worktree remove --force "$base_dir" >/dev/null 2>&1 || true
  rm -rf "$base_dir"
}
trap cleanup EXIT

cd "$root_dir"
node scripts/migration-upgrade-fixture.mjs reset

git worktree add --detach "$base_dir" "$BASE_SHA"

(
  cd "$base_dir"
  npm ci --no-audit --no-fund
  DATABASE_URL="$UPGRADE_DATABASE_URL" npm run db:generate
  DATABASE_URL="$UPGRADE_DATABASE_URL" npm run db:deploy
)

node scripts/migration-upgrade-fixture.mjs seed

DATABASE_URL="$UPGRADE_DATABASE_URL" npm run db:deploy
DATABASE_URL="$UPGRADE_DATABASE_URL" npx prisma migrate status

set +e
DATABASE_URL="$UPGRADE_DATABASE_URL" npx prisma migrate diff \
  --from-schema prisma \
  --to-config-datasource \
  --script \
  --exit-code > migration-upgrade-schema-diff.sql
schema_diff_code=$?
set -e

if [ "$schema_diff_code" -ne 0 ]; then
  echo "Base-to-head upgrade left Prisma-supported schema drift:" >&2
  cat migration-upgrade-schema-diff.sql >&2
  exit "$schema_diff_code"
fi

DATABASE_URL="$UPGRADE_DATABASE_URL" node scripts/verify-migration-integrity.mjs
node scripts/migration-upgrade-fixture.mjs verify

echo "Base-to-head migration upgrade verified from $BASE_SHA."
