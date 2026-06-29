// Smoke tests for every shared rule under .pi/extensions/rules/.
// Re-declares the rule regexes inline (plain node can't load .ts) and asserts
// the same scenarios. Keep regexes in sync with the .ts modules — when in
// doubt, copy the source regex back here verbatim.
//
// Run: node .pi/extensions/rules/all-rules.test.mjs

import assert from "node:assert/strict";

// ─── no-schema-outside-drizzle ─────────────────────────────────────────
{
  const TARGET = /(?:^|[\\/])packages[\\/]features[\\/].*\.(?:ts|tsx)$/;
  const CALL_RE = /\b(pgTable|pgEnum|pgView|pgMaterializedView|sqliteTable|mysqlTable)\s*\(/g;
  const DISABLE =
    /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-schema-outside-drizzle\b/;
  function shouldGuard(p) {
    return Boolean(p) && TARGET.test(p);
  }
  function findViolations(t) {
    const out = [];
    if (DISABLE.test(t)) out.push("disable-comment");
    for (const m of t.matchAll(CALL_RE)) out.push(m[1]);
    return out;
  }
  assert.equal(shouldGuard("packages/features/story/index.ts"), true);
  assert.equal(shouldGuard("packages/drizzle/src/schema/x.ts"), false);
  assert.deepEqual(findViolations('export const foo = pgTable("foo", {})'), ["pgTable"]);
  assert.deepEqual(
    findViolations("// eslint-disable-next-line product-builder/no-schema-outside-drizzle"),
    ["disable-comment"],
  );
  assert.deepEqual(findViolations("storyWorlds.id"), []);
  console.log("no-schema-outside-drizzle ✓");
}

// ─── no-db-in-controller ───────────────────────────────────────────────
{
  const TARGET = /(?:^|[\\/])packages[\\/]features[\\/].*(?:controller|\.router)\.tsx?$/;
  const OP = /\b(?:this\.|ctx\.)?(?:db|drizzle)\s*\.\s*(insert|update|delete|select|query)\b/g;
  const DISABLE =
    /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-db-in-controller\b/;
  function shouldGuard(p) {
    return Boolean(p) && TARGET.test(p);
  }
  function findViolations(t) {
    const out = [];
    if (DISABLE.test(t)) out.push("disable-comment");
    for (const m of t.matchAll(OP)) out.push(m[1]);
    return out;
  }
  assert.equal(shouldGuard("packages/features/payment/payment.controller.ts"), true);
  assert.equal(shouldGuard("packages/features/payment/trpc/admin.router.ts"), true);
  assert.equal(shouldGuard("packages/features/payment/service/foo.service.ts"), false);
  assert.deepEqual(findViolations("ctx.db.select().from(x)"), ["select"]);
  assert.deepEqual(findViolations("this.db.insert(x)"), ["insert"]);
  assert.deepEqual(findViolations("// eslint-disable-next-line product-builder/no-db-in-controller"), [
    "disable-comment",
  ]);
  assert.deepEqual(findViolations("service.doStuff()"), []);
  console.log("no-db-in-controller ✓");
}

// ─── no-manual-memoization ────────────────────────────────────────────
{
  const TARGET = /\.(?:ts|tsx)$/;
  const EXEMPT =
    /(?:^|\/)(?:scripts|__tests__|packages\/oxlint-plugin|packages\/ui\/src\/_shadcn)\//;
  const TEST_F = /\.(?:test|spec)\.(?:ts|tsx)$/;
  const USE_MEMO = /\b(?:React\s*\.\s*)?useMemo\s*\(/g;
  const USE_CB = /\b(?:React\s*\.\s*)?useCallback\s*\(/g;
  const MEMO_BARE = /\b(?:React\s*\.\s*)?memo\s*\(/g;
  function shouldGuard(p) {
    if (!p || !TARGET.test(p)) return false;
    if (EXEMPT.test(p)) return false;
    if (TEST_F.test(p)) return false;
    return true;
  }
  function findViolations(t) {
    const out = [];
    for (const m of t.matchAll(USE_MEMO)) out.push("useMemo");
    for (const m of t.matchAll(USE_CB)) out.push("useCallback");
    for (const m of t.matchAll(MEMO_BARE)) {
      if (/use(?:Memo|Callback)/.test(m[0])) continue;
      out.push("memo");
    }
    return out;
  }
  assert.equal(shouldGuard("apps/app/src/Foo.tsx"), true);
  assert.equal(shouldGuard("apps/app/src/Foo.test.tsx"), false);
  assert.equal(shouldGuard("packages/ui/src/_shadcn/button.tsx"), false);
  assert.deepEqual(findViolations("const x = useMemo(() => 1, [])"), ["useMemo"]);
  assert.deepEqual(findViolations("const fn = useCallback(() => {}, [])"), ["useCallback"]);
  assert.deepEqual(findViolations("export default memo(Component)"), ["memo"]);
  assert.deepEqual(findViolations("export default React.memo(Component)"), ["memo"]);
  assert.deepEqual(findViolations("const memoized = computeOnce()"), []);
  console.log("no-manual-memoization ✓");
}

// ─── no-local-css-import ──────────────────────────────────────────────
{
  const TARGET = /(?:^|\/)(?:apps|packages\/widgets)\/.*\.(?:ts|tsx)$/;
  const EXEMPT = /(?:^|\/)packages\/ui\/src\/_shadcn\//;
  const ENTRY = [
    /(?:^|\/)apps\/[^/]+\/src\/main\.tsx?$/,
    /(?:^|\/)apps\/[^/]+\/src\/app\/.*layout\.tsx?$/,
  ];
  const CSS_IMP =
    /\bimport\s+(?:[^;'"`]*\bfrom\s+)?["'](?:\.\.?\/|@\/|~\/|~)[^"']*\.css(?:\?[^"']*)?["']/g;
  function shouldGuard(p) {
    if (!p || !TARGET.test(p)) return false;
    if (EXEMPT.test(p)) return false;
    if (ENTRY.some((rx) => rx.test(p))) return false;
    return true;
  }
  function findViolations(t) {
    const out = [];
    for (const _m of t.matchAll(CSS_IMP)) out.push("import");
    return out;
  }
  assert.equal(shouldGuard("apps/app/src/features/foo/Foo.tsx"), true);
  assert.equal(shouldGuard("apps/app/src/main.tsx"), false, "main entry exempt");
  assert.equal(shouldGuard("apps/app/src/app/layout.tsx"), false, "next layout exempt");
  assert.equal(shouldGuard("packages/ui/src/_shadcn/button.tsx"), false);
  assert.deepEqual(findViolations('import "./foo.css";'), ["import"]);
  assert.deepEqual(findViolations('import styles from "../foo.css";'), ["import"]);
  assert.deepEqual(findViolations('import "@/styles/bar.css";'), ["import"]);
  assert.deepEqual(findViolations('import "katex/dist/katex.css";'), [], "vendor css allowed");
  console.log("no-local-css-import ✓");
}

// ─── e2e-spec-conventions ────────────────────────────────────────
{
  const TARGET = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/.*\.spec\.ts$/;
  const EXEMPT = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;
  const TS_FILE = /\.(?:ts|tsx)$/;
  const PLAYWRIGHT_IMPORT = /\bfrom\s+["']@playwright\/test["']/;
  const CJK = "[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]";
  const GET_BY_ROLE_NAME_CJK = new RegExp(
    `getByRole\\(\\s*["'\`][^"'\`]+["'\`]\\s*,\\s*\\{[^}]*\\bname\\s*:\\s*["'\`][^"'\`]*${CJK}[^"'\`]*["'\`]`,
    "g",
  );
  const GET_BY_TEXT_CJK = new RegExp(`getByText\\(\\s*["'\`][^"'\`]*${CJK}[^"'\`]*["'\`]`, "g");
  const WAIT_FOR_TIMEOUT = /\bpage\s*\.\s*waitForTimeout\s*\(/g;
  const SET_TIMEOUT_PROMISE = /\bnew\s+Promise\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*setTimeout\s*\(/g;
  const BARE_SET_TIMEOUT = /\bsetTimeout\s*\(/g;
  const PAGE_GOTO = /\bpage\.goto\s*\(\s*["'`]\//g;
  const PAGE_ROUTE = /\bpage\.route\s*\(/g;
  const DESCRIBE_RETRIES_RE = /test\.describe\.configure\s*\(\s*\{[^}]*\bretries\s*:\s*(\d+)/g;
  const TEST_SKIP_RE = /\btest\.(?:skip|fail)\s*\(\s*["'`]/g;
  const KEBAB_2PLUS = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+\.spec\.ts$/;
  const GENERIC_NAMES = new Set([
    "tests",
    "test",
    "e2e",
    "feature",
    "spec",
    "index",
    "sample",
    "example",
    "main",
    "untitled",
  ]);
  const LEVEL_TAGS = ["@critical", "@smoke", "@regression"];
  const DOMAIN_TAG_RE = /@(?!critical\b|smoke\b|regression\b|db\b)[a-z][a-z0-9-]+/g;

  function basename(p) {
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
  }
  function isInsideE2eSpec(p) {
    return TARGET.test(p) && !EXEMPT.test(p);
  }
  function shouldGuard(p) {
    if (!p) return false;
    if (!TS_FILE.test(p)) return false;
    if (EXEMPT.test(p)) return false;
    return true;
  }
  function extractFirstTitle(t) {
    const reD = /test\.describe(?:\.(?:serial|parallel|only|skip))?\s*\(\s*(["'`])([\s\S]*?)\1/;
    const reT = /\btest(?:\.(?:only|skip|fixme|fail))?\s*\(\s*(["'`])([\s\S]*?)\1/;
    return t.match(reD)?.[2] ?? t.match(reT)?.[2];
  }
  function findViolations(t, path = "") {
    const out = [];
    if (!isInsideE2eSpec(path)) {
      if (PLAYWRIGHT_IMPORT.test(t)) out.push("misplaced-e2e");
      return out;
    }
    const base = basename(path);
    if (base && !KEBAB_2PLUS.test(base)) {
      const root = base.replace(/\.spec\.ts$/, "");
      out.push(GENERIC_NAMES.has(root) ? "generic-filename" : "bad-filename");
    }
    const title = extractFirstTitle(t);
    if (title !== undefined) {
      const hits = LEVEL_TAGS.filter((x) => title.includes(x));
      if (hits.length === 0) out.push("missing-level-tag");
      else if (hits.length > 1) out.push("multiple-level-tags");
      const domainHits = title.match(DOMAIN_TAG_RE) ?? [];
      if (domainHits.length === 0) out.push("missing-domain-tag");
    }
    for (const _ of t.matchAll(GET_BY_ROLE_NAME_CJK)) out.push("cjk-role");
    for (const _ of t.matchAll(GET_BY_TEXT_CJK)) out.push("cjk-text");
    for (const _ of t.matchAll(WAIT_FOR_TIMEOUT)) out.push("wait-for-timeout");
    for (const _ of t.matchAll(SET_TIMEOUT_PROMISE)) out.push("setTimeout-hack");
    const stCount = (t.match(BARE_SET_TIMEOUT) || []).length;
    const pstCount = (t.match(SET_TIMEOUT_PROMISE) || []).length;
    if (stCount > pstCount) out.push("setTimeout-hack");
    const isExempt = !title || title.includes("@db") || title.includes("@design");
    if (!isExempt) {
      const g = (t.match(PAGE_GOTO) || []).length;
      const r = (t.match(PAGE_ROUTE) || []).length;
      if (g > 0 && r === 0) out.push("mock-required");
    }
    for (const m of t.matchAll(DESCRIBE_RETRIES_RE)) {
      if (Number(m[1]) > 1) out.push("retry-hack");
    }
    for (const _ of t.matchAll(TEST_SKIP_RE)) out.push("skip-or-fail");
    return out;
  }

  // path scope
  assert.equal(shouldGuard("apps/app/tests/e2e/auth-signin.spec.ts"), true);
  assert.equal(shouldGuard("apps/app/tests/e2e/_lib/helper.ts"), false);
  assert.equal(shouldGuard("apps/app/src/foo.ts"), true, "non-e2e ts 꿙 misplaced 검사");

  // misplaced (e2e 외부에서 @playwright/test import)
  assert.deepEqual(
    findViolations('import { test } from "@playwright/test";', "apps/app/src/foo.ts"),
    ["misplaced-e2e"],
  );
  assert.deepEqual(
    findViolations(
      'import { test } from "@playwright/test";',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    [],
    "e2e 안에서는 OK",
  );

  // filename
  assert.ok(
    findViolations(
      'test.describe("x @critical @auth", () => {});',
      "apps/app/tests/e2e/tests.spec.ts",
    ).includes("generic-filename"),
  );
  assert.ok(
    findViolations(
      'test.describe("x @critical @auth", () => {});',
      "apps/app/tests/e2e/Auth.spec.ts",
    ).includes("bad-filename"),
  );
  assert.equal(
    findViolations(
      'test.describe("x @critical @auth", () => {});',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).length,
    0,
  );

  // tag (level + domain)
  assert.deepEqual(
    findViolations(
      'test.describe("Auth sign-in @critical @auth", () => {});',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    [],
  );
  assert.deepEqual(
    findViolations(
      'test.describe("Auth sign-in @critical", () => {});',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    ["missing-domain-tag"],
  );
  assert.deepEqual(
    findViolations(
      'test.describe("Auth sign-in", () => {});',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    ["missing-level-tag", "missing-domain-tag"],
  );
  assert.deepEqual(
    findViolations(
      'test.describe("Auth @critical @smoke @auth", () => {});',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    ["multiple-level-tags"],
  );

  // cjk selector
  assert.ok(
    findViolations(
      'test.describe("X @critical @auth", () => {});\npage.getByRole("heading", { name: "\ub2e4\uc2dc" });',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("cjk-role"),
  );
  assert.ok(
    findViolations(
      'test.describe("X @critical @auth", () => {}); page.getByText("\ub85c\uadf8\uc778");',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("cjk-text"),
  );

  // timing
  assert.ok(
    findViolations(
      'test.describe("X @critical @auth", () => {}); await page.waitForTimeout(3000);',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("wait-for-timeout"),
  );
  assert.ok(
    findViolations(
      'test.describe("X @critical @auth", () => {}); await new Promise((r) => setTimeout(r, 100));',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("setTimeout-hack"),
  );

  // mock-first
  assert.ok(
    findViolations(
      'test.describe("x @critical @auth", () => {}); await page.goto("/sign-in");',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("mock-required"),
  );
  assert.equal(
    findViolations(
      'test.describe("x @critical @auth", () => {}); await page.route("**/api/auth/**", () => {}); await page.goto("/sign-in");',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).filter((v) => v === "mock-required").length,
    0,
  );
  assert.equal(
    findViolations(
      'test.describe("x @critical @auth @db", () => {}); await page.goto("/sign-in");',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).filter((v) => v === "mock-required").length,
    0,
    "@db 면 mock 아니고도 OK",
  );

  // flake hack
  assert.ok(
    findViolations(
      'test.describe("x @critical @auth", () => { test.describe.configure({ retries: 3 }); });',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("retry-hack"),
  );
  assert.ok(
    findViolations(
      'test.describe("x @critical @auth", () => { test.skip("flaky", async () => {}); });',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ).includes("skip-or-fail"),
  );

  // happy path
  assert.deepEqual(
    findViolations(
      'test.describe("Auth sign-in @critical @auth", () => {});\nawait page.route("**/api/auth/**", () => {});\nawait page.goto("/sign-in");\nawait expect(page.locator("[data-el=\\"login.submit-btn\\"]")).toBeVisible();',
      "apps/app/tests/e2e/auth-signin.spec.ts",
    ),
    [],
    "happy path clean",
  );

  console.log("e2e-spec-conventions ✓");
}

// ─── test-file-location ────────────────────────────────────────────
{
  const SPEC_ALLOWED = [
    /(?:^|\/)apps\/[^/]+\/tests\/e2e\//,
    /(?:^|\/)apps\/server\/src\//,
    /(?:^|\/)packages\/features\//,
    /(?:^|\/)packages\/data\//,
    /(?:^|\/)packages\/core\//,
    /(?:^|\/)packages\/drizzle\/src\//,
    /(?:^|\/)scripts\//,
    /(?:^|\/)\.pi\//,
  ];
  const TEST_ALLOWED = [
    /(?:^|\/)apps\/app\/src\//,
    /(?:^|\/)apps\/admin\/src\//,
    /(?:^|\/)packages\/(?:ui|graphify)\/src\//,
    /(?:^|\/)graphify-mini\/.*\/src\//,
    /(?:^|\/)packages\/core\//,
    /(?:^|\/)apps\/server\/src\//,
  ];
  const E2E_HELPER_DIR = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;
  const NODE_MODULES = /(?:^|\/)node_modules\//;
  const DIST = /(?:^|\/)dist\//;
  const SPEC_EXT = /\.spec\.ts$/;
  const TEST_EXT = /\.test\.(?:ts|tsx)$/;

  function shouldGuard(p) {
    if (!p) return false;
    if (NODE_MODULES.test(p)) return false;
    if (DIST.test(p)) return false;
    if (E2E_HELPER_DIR.test(p)) return false;
    return SPEC_EXT.test(p) || TEST_EXT.test(p);
  }
  function inAny(p, table) {
    for (const rx of table) if (rx.test(p)) return true;
    return false;
  }
  function findViolations(_t, path = "") {
    if (!shouldGuard(path)) return [];
    if (SPEC_EXT.test(path) && !inAny(path, SPEC_ALLOWED)) return ["spec-misplaced"];
    if (TEST_EXT.test(path) && !inAny(path, TEST_ALLOWED)) return ["test-misplaced"];
    return [];
  }

  assert.equal(shouldGuard("apps/app/tests/e2e/auth-signin.spec.ts"), true);
  assert.equal(shouldGuard("apps/app/tests/e2e/_lib/helper.spec.ts"), false);
  assert.equal(shouldGuard("node_modules/foo/bar.spec.ts"), false);
  assert.equal(shouldGuard("apps/app/src/Foo.tsx"), false);

  assert.deepEqual(findViolations("", "apps/app/tests/e2e/auth-signin.spec.ts"), []);
  assert.deepEqual(findViolations("", "apps/server/src/payment/foo.spec.ts"), []);
  assert.deepEqual(findViolations("", "packages/features/payment/service/x.spec.ts"), []);
  assert.deepEqual(findViolations("", "packages/data/test/foo.spec.ts"), []);
  assert.deepEqual(findViolations("", "scripts/foo.spec.ts"), []);

  assert.deepEqual(findViolations("", "apps/app/src/components/Foo.spec.ts"), ["spec-misplaced"]);
  assert.deepEqual(findViolations("", "packages/ui/src/Foo.spec.ts"), ["spec-misplaced"]);

  assert.deepEqual(findViolations("", "apps/app/src/Foo.test.tsx"), []);
  assert.deepEqual(findViolations("", "apps/app/src/__tests__/Foo.test.ts"), []);
  assert.deepEqual(findViolations("", "packages/ui/src/__tests__/Btn.test.tsx"), []);

  assert.deepEqual(findViolations("", "packages/features/payment/service/x.test.ts"), [
    "test-misplaced",
  ]);
  assert.deepEqual(findViolations("", "packages/data/codec/foo.test.ts"), ["test-misplaced"]);
  // apps/server/src/ 은 vitest .test.ts 도 허용 (config/env.test.ts 등)
  assert.deepEqual(findViolations("", "apps/server/src/foo.test.ts"), []);

  console.log("test-file-location ✓");
}

console.log("\nAll rules: assertions passed ✓");
