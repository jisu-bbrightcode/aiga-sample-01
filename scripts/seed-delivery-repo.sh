#!/usr/bin/env bash
# PB-REPO-001 — seed the customer delivery repo from product-builder-base.
#
# PRECONDITION (the one blocker): runner identity `bright2024` must have WRITE on
#   github.com/jisu-bbrightcode/aiga-sample-01  (verify: this script's push step).
# Until that grant is effective this script will 403 on push — that is expected and
# is the entire content of the PB-REPO-001 blocker.
#
# Idempotent-ish: refuses to run if the delivery repo already has commits on main.
set -euo pipefail

BASE_REPO="https://github.com/BBrightcode-atlas/product-builder-base.git"
BASE_SHA="111d7721dae1aeeef764f3caf0005d16993a704a"
DELIVERY_REMOTE="origin"            # -> https://github.com/jisu-bbrightcode/aiga-sample-01.git
SEED_TAG="base/v1-111d7721"
WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 0. Preconditions"
cd "$WORKDIR"
git remote get-url "$DELIVERY_REMOTE" >/dev/null
if git ls-remote --heads "$DELIVERY_REMOTE" main | grep -q main; then
  echo "ABORT: delivery repo already has a 'main' branch — seed already happened. Re-vendor manually."
  exit 1
fi

echo "==> 1. Verify push access (fail fast with the real blocker if absent)"
if ! git push --dry-run "$DELIVERY_REMOTE" "HEAD:refs/heads/__seed_access_probe__" 2>/tmp/seed_probe.err; then
  echo "BLOCKED: cannot push to delivery repo. bright2024 lacks write access."
  sed 's/^/    /' /tmp/seed_probe.err
  exit 2
fi

echo "==> 2. Fetch base tree @ $BASE_SHA"
TMP="$(mktemp -d)"
git clone --no-checkout --filter=blob:none "$BASE_REPO" "$TMP/base"
git -C "$TMP/base" checkout "$BASE_SHA"

echo "==> 3. Build seed commit on a fresh 'main' (base content = initial commit)"
git -C "$TMP/base" archive "$BASE_SHA" | (mkdir -p "$TMP/tree" && tar -x -C "$TMP/tree")
git switch --orphan main
git rm -rfq --cached . 2>/dev/null || true
# clear tracked working tree (keep .git), then lay down base content
find . -maxdepth 1 -mindepth 1 ! -name '.git' -exec rm -rf {} +
cp -R "$TMP/tree"/. .
git add -A
git commit -q -m "chore(seed): vendor product-builder-base@111d7721 as AIGA delivery base" \
  -m "Source: BBrightcode-atlas/product-builder-base@${BASE_SHA}
Relationship: vendored derivation snapshot (NOT a fork). See doc/plans/PB-REPO-001-delivery-repo-workspace-binding.md.
Base upgrades are re-vendored against a new pinned SHA, never auto-merged."
git tag -a "$SEED_TAG" -m "product-builder-base pinned seed ${BASE_SHA}"

echo "==> 4. Push main + tag"
git push -u "$DELIVERY_REMOTE" main
git push "$DELIVERY_REMOTE" "$SEED_TAG"

echo "==> 5. Push in-workspace docs branches (binding spec etc.)"
for b in docs/pb-repo-001-delivery-binding docs/pb-base-001-base-readiness docs/pb-decide-001-decision-dashboard; do
  git show-ref --verify --quiet "refs/heads/$b" && git push "$DELIVERY_REMOTE" "$b" || true
done

echo "==> DONE. Delivery repo seeded. Next: set branch protection on main + wire Vercel (PB-INFRA-001)."
rm -rf "$TMP"
