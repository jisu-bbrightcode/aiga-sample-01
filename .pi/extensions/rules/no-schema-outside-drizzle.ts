// @ts-nocheck
/**
 * Mirror of `packages/oxlint-plugin/src/rules/no-schema-outside-drizzle.mjs`.
 *
 * Forbid drizzle schema definitions outside `packages/drizzle/src/schema/`.
 * Targeted file glob: `packages/features/**\/*.ts(x)`.
 *
 * Detection: `pgTable(`, `pgEnum(`, `pgView(`, `pgMaterializedView(`,
 * `sqliteTable(`, `mysqlTable(` as identifier calls.
 *
 * Disable directives for this rule are also blocked.
 */

import { clip, type Violation } from "./lib.ts";

export const TARGET_PATH = /(?:^|[\\/])packages[\\/]features[\\/].*\.(?:ts|tsx)$/;

const FORBIDDEN_CALLEES = [
  "pgTable",
  "pgEnum",
  "pgView",
  "pgMaterializedView",
  "sqliteTable",
  "mysqlTable",
] as const;

const CALL_RE = new RegExp(`\\b(${FORBIDDEN_CALLEES.join("|")})\\s*\\(`, "g");

const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-schema-outside-drizzle\b/;

export function shouldGuard(path: string): boolean {
  return Boolean(path) && TARGET_PATH.test(path);
}

export function findViolations(text: string): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;
  if (DISABLE_COMMENT_RE.test(text)) {
    const m = text.match(DISABLE_COMMENT_RE);
    out.push({
      rule: "no-schema-outside-drizzle",
      kind: "disable-comment",
      snippet: clip(m?.[0] ?? ""),
    });
  }
  for (const m of text.matchAll(CALL_RE)) {
    out.push({
      rule: "no-schema-outside-drizzle",
      kind: m[1],
      snippet: clip(m[0]),
    });
  }
  return out;
}

export const ADVICE = [
  "  • drizzle schema 는 packages/drizzle/src/schema/ 안에서만 정의",
  '  • feature 코드는 schema 를 import 만 (`import { storyWorlds } from "@repo/drizzle/schema"`)',
  "  • 룰: docs/rules/feature/schema.md",
] as const;
