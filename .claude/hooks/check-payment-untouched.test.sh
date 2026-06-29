#!/usr/bin/env bash
# Tests for check-payment-untouched.sh — Iron Law 1.
# Hook contract: stdin JSON tool_input.file_path (preferred) + TOOL_INPUT env (fallback).
# Tests cover: safe paths, protected paths, absolute, relative ./, relative ../,
# stdin-only delivery (no env var).
set -euo pipefail

HOOK="$(dirname "$0")/check-payment-untouched.mjs"
[ -f "$HOOK" ] || { echo "FAIL: hook missing"; exit 1; }

# Helper: send tool_input.file_path on stdin, no env var.
stdin_only() {
  local file_path="$1"
  printf '{"tool_input":{"file_path":%s}}' "$(node -e "process.stdout.write(JSON.stringify(process.argv[1]))" "$file_path")" | node "$HOOK" 2>&1
}

# Helper: env var only, empty stdin.
env_only() {
  local file_path="$1"
  printf '' | TOOL_INPUT="$file_path" node "$HOOK" 2>&1
}

# Both deliveries must agree per case.
check_allow() {
  local label="$1"
  local file_path="$2"
  for variant in stdin_only env_only; do
    out=$("$variant" "$file_path")
    if ! echo "$out" | grep -q '"decision": *"allow"'; then
      echo "FAIL [$label / $variant]: should ALLOW: $file_path"
      echo "Output: $out"
      exit 1
    fi
  done
}
check_block() {
  local label="$1"
  local file_path="$2"
  for variant in stdin_only env_only; do
    out=$("$variant" "$file_path")
    if ! echo "$out" | grep -q '"decision": *"block"'; then
      echo "FAIL [$label / $variant]: should BLOCK: $file_path"
      echo "Output: $out"
      exit 1
    fi
  done
}

# Safe paths
check_allow "safe relative"     "apps/app/src/pages/settings/profile/profile-page.tsx"
check_allow "safe ui"           "packages/ui/src/settings/SetSection.tsx"
check_allow "safe docs"         "docs/superpowers/plans/2026-04-27-settings-redesign.md"
check_allow "safe admin"        "apps/admin/src/pages/admin/users.tsx"
check_allow "safe ./ prefix"    "./apps/app/src/pages/settings/profile/profile-page.tsx"

# Protected paths — relative
check_block "protected payment feature"   "packages/features/payment/payment.module.ts"
check_block "protected payment trpc"      "packages/features/payment/trpc/auth.router.ts"
check_block "protected app payment hook"  "apps/app/src/features/payment/hooks/use-checkout.ts"
check_block "protected app payment comp"  "apps/app/src/features/payment/components/subscription-card.tsx"
check_block "protected server payment"    "apps/server/src/api/payment/payment.controller.ts"
check_block "protected server payment-webhook" "apps/server/src/api/payment-webhook.ts"

# Protected — relative with ./ prefix (BLOCKING from codex review)
check_block "protected ./ prefix"    "./packages/features/payment/payment.module.ts"
check_block "protected ./ deep"      "./apps/app/src/features/payment/hooks/use-checkout.ts"

# Protected — absolute
abs="$(pwd)/packages/features/payment/payment.module.ts"
check_block "protected absolute"     "$abs"

# Protected — relative with ../ that resolves into protected path
# (e.g. inside .worktrees/settings-redesign/, ../foo would escape; we accept that
# edge as out-of-scope — but a path like apps/../packages/features/payment should
# normalize and block).
check_block "protected via .. inside repo" "apps/foo/../../packages/features/payment/x.ts"

# Empty input → ALLOW
out=$(printf '' | node "$HOOK" 2>&1)
if ! echo "$out" | grep -q '"decision": *"allow"'; then
  echo "FAIL: empty input should ALLOW; got: $out"
  exit 1
fi

echo "OK"
