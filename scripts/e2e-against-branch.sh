#!/usr/bin/env bash
# Run the Playwright @db E2E suite against a real Postgres DATABASE_URL.
#
# Mirrors `.github/workflows/e2e-against-pg-branch.yml` so a developer can
# reproduce CI failures locally. The database is expected to be an existing
# local Postgres instance or service container, then migrations are applied,
# server + apps/app are started, and Playwright runs against @db specs.
#
# Env:
#   DATABASE_URL  Existing Postgres URL. Defaults to the local service-container
#                 URL used by CI:
#                 postgresql://product_builder_test:product_builder_test@localhost:5432/product_builder_test
#
# Usage:
#   bash scripts/e2e-against-branch.sh
#   DATABASE_URL=postgresql://user:pass@localhost:5432/db bash scripts/e2e-against-branch.sh
#   bash scripts/e2e-against-branch.sh -- --grep lore-rail   # extra playwright args

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Auto-load .env.local so developers can run without manual `export DATABASE_URL=...`.
if [ -f "$REPO_ROOT/.env.local" ]; then
	set -a
	# shellcheck disable=SC1091
	. "$REPO_ROOT/.env.local"
	set +a
fi

if [ "${1:-}" = "--" ]; then
	shift
fi

DEFAULT_DATABASE_URL="postgresql://product_builder_test:product_builder_test@localhost:5432/product_builder_test"
if [ -z "${DATABASE_URL:-}" ]; then
	export DATABASE_URL="$DEFAULT_DATABASE_URL"
	echo "[e2e-against-branch] DATABASE_URL not set; using default local Postgres URL."
	echo "[e2e-against-branch] Expecting a local postgres/service container already running at localhost:5432."
else
	export DATABASE_URL
	echo "[e2e-against-branch] using provided DATABASE_URL (host masked)"
fi

SERVER_PID=""
APP_PID=""

cleanup() {
	local rc=$?
	set +e
	if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; fi
	if [ -n "$APP_PID" ]; then kill "$APP_PID" 2>/dev/null; fi
	exit "$rc"
}
trap cleanup EXIT

echo "[e2e-against-branch] applying drizzle migrations"
pnpm --filter @repo/drizzle db:migrate

echo "[e2e-against-branch] installing playwright chromium"
pnpm --filter app exec playwright install --with-deps chromium

echo "[e2e-against-branch] building server"
pnpm --filter server build
echo "[e2e-against-branch] starting server"
pnpm --filter server start:prod >/tmp/product-builder-e2e-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do
	if nc -z localhost 3001 2>/dev/null; then break; fi
	sleep 1
done

echo "[e2e-against-branch] building apps/app"
pnpm --filter app build
echo "[e2e-against-branch] starting apps/app"
pnpm --filter app preview --host 127.0.0.1 --port 3000 >/tmp/product-builder-e2e-app.log 2>&1 &
APP_PID=$!
for _ in $(seq 1 30); do
	if nc -z localhost 3000 2>/dev/null; then break; fi
	sleep 1
done

echo "[e2e-against-branch] running playwright @db specs"
PLAYWRIGHT_GREP="${PLAYWRIGHT_GREP:-@db}" pnpm --filter app exec playwright test --reporter=list "$@"
