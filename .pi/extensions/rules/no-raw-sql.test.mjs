// Smoke test for the shared no-raw-sql rule data + detection logic.
// Run: node .pi/extensions/rules/no-raw-sql.test.mjs
//
// We can't import the .ts module directly (no transpiler in plain node).
// Instead we re-declare the regexes here and assert the same scenarios.
// Keep this file in sync with `.pi/extensions/rules/no-raw-sql.ts`.

import assert from "node:assert/strict";

const TARGET_PATH =
  /(?:^|\/)(apps\/server\/src|packages\/(?:features|core|data))\/.*\.(?:ts|tsx)$/;
const EXEMPT_PATH = /(?:^|\/)(?:scripts|migrations|__tests__|packages\/oxlint-plugin)\//;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/;

function shouldGuard(path) {
  if (!path) return false;
  if (!TARGET_PATH.test(path)) return false;
  if (EXEMPT_PATH.test(path)) return false;
  if (TEST_FILE.test(path)) return false;
  return true;
}

// ── path guard cases ─────────────────────────────────────────────────────
assert.equal(shouldGuard("packages/features/payment/service/foo.ts"), true);
assert.equal(shouldGuard("apps/server/src/main.ts"), true);
assert.equal(shouldGuard("packages/data/remote/index.ts"), true);
assert.equal(shouldGuard("scripts/foo.mjs"), false, "scripts exempt");
assert.equal(shouldGuard("packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs"), false);
assert.equal(shouldGuard("packages/features/foo.test.ts"), false, "test exempt");
assert.equal(shouldGuard("apps/app/src/main.tsx"), false, "out-of-scope");

// ── detection regex cases ────────────────────────────────────────────────
const NATIVE_SQL_CALL_RE =
  /\b(?:\w+)\.(?:query|exec)\s*\(\s*(?:`([^`]*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
const SQL_TAG_EXECUTE_RE = /\.(?:execute|run|unsafe)\s*\(\s*sql`([\s\S]*?)`/g;
const SQL_TAG_AWAIT_RE = /\bawait\s+sql`([\s\S]*?)`/g;
const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-raw-sql-query\b/;
const ALLOWED = [
  /\bpg_advisory_(?:xact_)?(?:try_)?(?:un)?lock(?:_shared)?\b/i,
  /\bFOR\s+UPDATE\b/i,
  /\bFOR\s+SHARE\b/i,
];
const bodyAllowed = (s) => ALLOWED.some((r) => r.test(s));

function findViolations(text) {
  const out = [];
  if (DISABLE_COMMENT_RE.test(text)) out.push("disable-comment");
  for (const m of text.matchAll(NATIVE_SQL_CALL_RE)) {
    const body = m[1] ?? m[2] ?? m[3] ?? "";
    if (!body.trim()) continue;
    if (bodyAllowed(body)) continue;
    out.push("native-query");
  }
  for (const m of text.matchAll(SQL_TAG_EXECUTE_RE)) {
    if (bodyAllowed(m[1])) continue;
    out.push("drizzle-execute");
  }
  for (const m of text.matchAll(SQL_TAG_AWAIT_RE)) {
    if (bodyAllowed(m[1])) continue;
    out.push("drizzle-await");
  }
  return out;
}

// ── violations ───────────────────────────────────────────────────────────
assert.deepEqual(
  findViolations('await db.query("SELECT * FROM foo")'),
  ["native-query"],
  "native query blocked",
);
assert.deepEqual(
  findViolations("await db.execute(sql`SELECT 1`)"),
  ["drizzle-execute"],
  "drizzle execute blocked",
);
assert.deepEqual(
  findViolations("const x = await sql`SELECT 1`"),
  ["drizzle-await"],
  "postgres-js bare await blocked",
);
assert.deepEqual(
  findViolations("// eslint-disable-next-line product-builder/no-raw-sql-query"),
  ["disable-comment"],
  "disable comment blocked",
);
assert.deepEqual(
  findViolations('await tx.query("INSERT INTO local_change_log (table_name) VALUES ($1)", [t])'),
  ["native-query"],
  "local_change_log outbox write blocked",
);
assert.deepEqual(
  findViolations("await db.execute(sql`SELECT pg_advisory_xact_lock(1)`)"),
  [],
  "advisory lock allowed",
);
assert.deepEqual(
  findViolations("await db.execute(sql`SELECT * FROM foo FOR UPDATE`)"),
  [],
  "FOR UPDATE allowed",
);
assert.deepEqual(
  findViolations("qb.select({ s: sql`COALESCE(SUM(x), 0)::int` }).from(t)"),
  [],
  "select-projection sql fragment allowed (no .execute)",
);

console.log("rules/no-raw-sql: all assertions passed ✓");
