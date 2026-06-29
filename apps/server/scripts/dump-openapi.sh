#!/usr/bin/env bash
# dump-openapi.sh
#
# Dump approach: CURL FALLBACK (offline bootstrap not used).
# Reason: tsx/esbuild does not propagate experimentalDecorators across workspace packages.
# The live server already exposes /api-docs/json, so starting it and curling is simpler
# and more reliable than fighting the ESM/decorator compile chain.
#
# Usage (called by pnpm openapi:dump):
#   bash scripts/dump-openapi.sh <output-path>
#
# The script:
#   1. Starts the NestJS dev server in background (nest start)
#   2. Waits up to 30s for /api-docs/json to respond
#   3. Curls the spec and writes to <output-path>
#   4. Kills the background server

set -euo pipefail

OUT="${1:-../../packages/api-client/openapi.json}"
PORT="${PORT:-3002}"
URL="http://localhost:${PORT}/api-docs/json"
MAX_WAIT=30
PID=""

cleanup() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if curl -sf "$URL" -o /dev/null 2>/dev/null; then
  echo "ERROR: $URL is already serving a response." >&2
  echo "Stop the existing server or rerun with a free PORT so OpenAPI dump can use its deterministic fixture env." >&2
  exit 1
else
  echo "Starting server (nest start)..."
  # Keep the OpenAPI contract deterministic in CI and local runs. Optional
  # provider-backed modules are normally gated by real secrets, but the spec
  # dump needs their controllers registered without depending on local .env
  # contents.
  OPENAPI_DUMP=1 \
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/atlas" \
  POLAR_ACCESS_TOKEN="polar_oat_openapi_dump" \
  POLAR_ENV="sandbox" \
  POLAR_ORGANIZATION_ID="openapi-dump-org" \
  APP_URL="http://localhost:${PORT}" \
  PAYMENT_INICIS_MODE="test" \
  PAYMENT_INICIS_MID="INIpayTest" \
  PAYMENT_INICIS_SIGN_KEY="openapi-dump-sign-key" \
  PAYMENT_INICIS_INI_API_KEY="openapi-dump-api-key" \
  PAYMENT_INICIS_CLIENT_IP="127.0.0.1" \
  PAYMENT_INICIS_NOTI_ALLOWED_IPS="127.0.0.1" \
  SOLAPI_ENABLED="true" \
  SOLAPI_API_KEY="solapi_openapi_dump_key" \
  SOLAPI_API_SECRET="solapi_openapi_dump_secret" \
  SOLAPI_DEFAULT_SENDER="0212345678" \
  SOLAPI_WEBHOOK_SECRET="solapi_openapi_dump_webhook_secret" \
  npx nest start --config nest-cli.json > /tmp/dump-openapi-server.log 2>&1 &
  PID=$!

  elapsed=0
  until curl -sf "$URL" -o /dev/null 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $MAX_WAIT ]; then
      echo "ERROR: Server did not start within ${MAX_WAIT}s. Log:" >&2
      tail -20 /tmp/dump-openapi-server.log >&2
      exit 1
    fi
    echo "  Waiting for server... ${elapsed}s"
  done
  echo "Server ready after ${elapsed}s."
fi

curl -sf "$URL" -o "$OUT"
echo "OpenAPI spec written to $OUT"
