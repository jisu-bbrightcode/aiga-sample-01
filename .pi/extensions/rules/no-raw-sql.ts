// @ts-nocheck
/**
 * Shared rule data + detection logic for "no raw SQL".
 *
 * Mirrors `packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs` so the
 * write-time Pi gate (`.pi/extensions/no-raw-sql-write/`) and the lint-time
 * oxlint rule stay in lockstep. Update both when widening the allow-list.
 *
 * This file is intentionally framework-free: no pi runtime imports, no
 * file-system or process calls. That keeps it cheap to load from any number
 * of Pi extensions (`tool_call` hooks, `turn_end` hooks, bash-guard hooks)
 * and from the smoke test.
 */

// ── target / exempt path matchers ────────────────────────────────────────────
export const TARGET_PATH =
  /(?:^|\/)(apps\/server\/src|packages\/(?:features|core|data))\/.*\.(?:ts|tsx)$/;

export const EXEMPT_PATH =
  /(?:^|\/)(?:scripts|migrations|__tests__|packages\/oxlint-plugin)\//;

export const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/;

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!TARGET_PATH.test(path)) return false;
  if (EXEMPT_PATH.test(path)) return false;
  if (TEST_FILE.test(path)) return false;
  return true;
}

// ── allowed SQL body patterns (mirror oxlint rule) ──────────────────────────
export const ALLOWED_BODY_PATTERNS: readonly RegExp[] = [
  /\bpg_advisory_(?:xact_)?(?:try_)?(?:un)?lock(?:_shared)?\b/i,
  /\bFOR\s+UPDATE\b/i,
  /\bFOR\s+SHARE\b/i,
];

export function bodyIsAllowed(body: string): boolean {
  for (const rx of ALLOWED_BODY_PATTERNS) if (rx.test(body)) return true;
  return false;
}

// ── detection regexes ────────────────────────────────────────────────────────
/** `db.query("SELECT ...")` / `tx.exec("UPDATE ...")` native raw SQL. */
export const NATIVE_SQL_CALL_RE =
  /\b(?:\w+)\.(?:query|exec)\s*\(\s*(?:`([^`]*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

/** `db.execute(sql`...`)` / `.run(sql`...`)` / `.unsafe(sql`...`)`. */
export const SQL_TAG_EXECUTE_RE = /\.(?:execute|run|unsafe)\s*\(\s*sql`([\s\S]*?)`/g;

/** `await sql`...`` — postgres-js direct usage. */
export const SQL_TAG_AWAIT_RE = /\bawait\s+sql`([\s\S]*?)`/g;

/**
 * Inline lint-disable comments targeting `product-builder/no-raw-sql-query`. Both
 * `eslint-disable*` and `oxlint-disable*` directive families are blocked.
 */
export const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-raw-sql-query\b/;

// ── violation finder ────────────────────────────────────────────────────────
export interface Violation {
  kind: "native-query" | "drizzle-execute" | "drizzle-await" | "disable-comment";
  snippet: string;
}

export function findViolations(text: string): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;

  if (DISABLE_COMMENT_RE.test(text)) {
    const m = text.match(DISABLE_COMMENT_RE);
    out.push({ kind: "disable-comment", snippet: m ? m[0] : "" });
  }

  for (const m of text.matchAll(NATIVE_SQL_CALL_RE)) {
    const body = m[1] ?? m[2] ?? m[3] ?? "";
    if (!body.trim()) continue;
    if (bodyIsAllowed(body)) continue;
    out.push({ kind: "native-query", snippet: m[0].slice(0, 120) });
  }

  for (const m of text.matchAll(SQL_TAG_EXECUTE_RE)) {
    const body = m[1] ?? "";
    if (bodyIsAllowed(body)) continue;
    out.push({
      kind: "drizzle-execute",
      snippet: `.execute(sql\`${body.slice(0, 80).trim()}…\`)`,
    });
  }

  for (const m of text.matchAll(SQL_TAG_AWAIT_RE)) {
    const body = m[1] ?? "";
    if (bodyIsAllowed(body)) continue;
    out.push({
      kind: "drizzle-await",
      snippet: `await sql\`${body.slice(0, 80).trim()}…\``,
    });
  }

  return out;
}

// ── reason builder ──────────────────────────────────────────────────────────
export function buildBlockMessage(violations: readonly Violation[]): string {
  const examples = violations
    .slice(0, 3)
    .map((v) => `  • [${v.kind}] ${v.snippet}`)
    .join("\n");
  return [
    "Raw SQL 작성 차단 (no-raw-sql-write extension).",
    "",
    "이 영역 (apps/server, packages/{features,core,data/electron-main}) 에서는 raw SQL 을",
    "사용할 수 없습니다. drizzle query builder 만 허용됩니다.",
    "",
    "감지된 위반:",
    examples,
    "",
    "사용해야 하는 방법:",
    "  • SELECT/INSERT/UPDATE/DELETE  →  qb.select() / .insert() / .update() / .delete()",
    "  • 집계 (SUM/COUNT/CASE 등)      →  qb.select({ x: sql`...` }).from(...) ",
    "      (select projection 안의 sql fragment 는 허용 — 룰이 .execute() 만 잡음)",
    "  • Dynamic table dispatch        →  Record<Kind, PgTable> object + builder",
    "  • Outbox / advisory lock 등     →  ALREADY 자동 허용 (pg_advisory_*, FOR UPDATE, local_change_log)",
    "",
    "정당한 새 예외가 필요하면 lint 룰의 ALLOWED_PATTERNS 를 PR 로 확장하세요:",
    "  packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs",
    "  .pi/extensions/rules/no-raw-sql.ts (write-time gate 도 함께)",
    "",
    "disable comment (// eslint-disable-next-line product-builder/no-raw-sql-query) 는 거부됩니다.",
    "근거: docs/rules/no-raw-sql-lockdown.md",
  ].join("\n");
}
