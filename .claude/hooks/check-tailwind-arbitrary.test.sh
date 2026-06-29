#!/usr/bin/env bash
# Tests for check-tailwind-arbitrary.sh — Iron Law 4.
set -euo pipefail

HOOK="$(dirname "$0")/check-tailwind-arbitrary.mjs"
[ -f "$HOOK" ] || { echo "FAIL: hook missing"; exit 1; }

# Helper — send full tool_input JSON on stdin
run() {
  local file_path="$1"
  local content="$2"
  node -e "process.stdout.write(JSON.stringify({tool_input:{file_path:process.argv[1],content:process.argv[2]}}))" "$file_path" "$content" | node "$HOOK" 2>&1
}

assert_allow() {
  local label="$1"; shift
  local out
  out=$(run "$@")
  echo "$out" | grep -q '"decision": *"allow"' || { echo "FAIL [$label]: $out"; exit 1; }
}
assert_block() {
  local label="$1"; shift
  local out
  out=$(run "$@")
  echo "$out" | grep -q '"decision": *"block"' || { echo "FAIL [$label]: $out"; exit 1; }
}

# 1. Out-of-scope file with arbitrary → ALLOW
assert_allow "out-of-scope arbitrary" \
  "apps/app/src/pages/other/x.tsx" \
  'export const X = () => <div className="text-[12px]" />;'

# 2. In-scope (pages/settings) with `text-[Npx]` → BLOCK
assert_block "settings text-[13px]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="text-[13px]" />;'

# 3. In-scope (ui/settings) with `w-[Npx]` → BLOCK
assert_block "ui-settings w-[247px]" \
  "packages/ui/src/settings/SetSection.tsx" \
  'export const S = () => <div className="w-[247px]" />;'

# 4. Token-only classes → ALLOW
assert_allow "settings tokens-only" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="text-base text-foreground" />;'

# 5. Test file in-scope → ALLOW
assert_allow "settings test file" \
  "apps/app/src/pages/settings/profile/profile-page.test.tsx" \
  'expect(div).toHaveClass("text-[13px]");'

# 6. Empty input → ALLOW
out=$(printf '' | node "$HOOK" 2>&1)
echo "$out" | grep -q '"decision": *"allow"' || { echo "FAIL: empty -> $out"; exit 1; }

# 7. ./ prefix with arbitrary → BLOCK (path normalization)
assert_block "./ prefix arbitrary" \
  "./apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="text-[13px]" />;'

# 8. Codex BLOCKING patterns — must catch all
assert_block "settings bg-[red]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="bg-[red]" />;'

assert_block "settings translate-x-[2px]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="translate-x-[2px]" />;'

assert_block "settings border-[1px]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="border-[1px]" />;'

assert_block "settings shadow-[0_2px_4px_rgba(0,0,0,0.1)]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="shadow-[0_2px_4px_rgba(0,0,0,0.1)]" />;'

assert_block "settings ring-[3px]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="ring-[3px]" />;'

assert_block "settings from-[#abc]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="from-[#abc] to-[#def]" />;'

assert_block "settings size-[40px]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="size-[40px]" />;'

# 9. Allowlist — data-[...], aria-[...], group-[...], peer-[...] should NOT block
assert_allow "settings data-[state=open]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="data-[state=open]:text-foreground" />;'

assert_allow "settings group-[.is-on]" \
  "apps/app/src/pages/settings/profile/profile-page.tsx" \
  'export const P = () => <div className="group-[.is-on]:text-foreground" />;'

# 10. New scope — apps/app/src/features/settings/** should be in scope
assert_block "features/settings arbitrary" \
  "apps/app/src/features/settings/components/X.tsx" \
  'export const X = () => <div className="bg-[red]" />;'

# 11. .ts utility file in scope with arbitrary class string → BLOCK
assert_block "settings .ts arbitrary class string" \
  "apps/app/src/pages/settings/profile/use-profile.ts" \
  'export const CLS = "text-[13px]";'

# 12. .css file in scope with arbitrary → BLOCK
assert_block "settings .css arbitrary" \
  "apps/app/src/pages/settings/profile/profile.css" \
  '.x { @apply text-[13px]; }'

echo "OK"
