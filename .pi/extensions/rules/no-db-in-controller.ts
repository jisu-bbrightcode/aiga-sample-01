// @ts-nocheck
/**
 * Mirror of `packages/oxlint-plugin/src/rules/no-db-in-controller.mjs`.
 *
 * Forbid direct DB access from controllers / tRPC routers. Targeted file
 * glob: `packages/features/**\/(*.controller|*.router).ts(x)`.
 *
 * Detection (regex approximation of the AST rule):
 *   - `(this\.|ctx\.)?db.<op>(`  where op ∈ {insert,update,delete,select,query}
 *   - `drizzle.<op>(`            (same op set)
 *
 * Move logic into a Service.
 */

import { clip, type Violation } from "./lib.ts";

export const TARGET_PATH = /(?:^|[\\/])packages[\\/]features[\\/].*(?:controller|\.router)\.tsx?$/;

const DB_OP_RE = /\b(?:this\.|ctx\.)?(?:db|drizzle)\s*\.\s*(insert|update|delete|select|query)\b/g;

const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-db-in-controller\b/;

export function shouldGuard(path: string): boolean {
  return Boolean(path) && TARGET_PATH.test(path);
}

export function findViolations(text: string): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;
  if (DISABLE_COMMENT_RE.test(text)) {
    const m = text.match(DISABLE_COMMENT_RE);
    out.push({ rule: "no-db-in-controller", kind: "disable-comment", snippet: clip(m?.[0] ?? "") });
  }
  for (const m of text.matchAll(DB_OP_RE)) {
    out.push({ rule: "no-db-in-controller", kind: m[1], snippet: clip(m[0]) });
  }
  return out;
}

export const ADVICE = [
  "  • Controller / tRPC router 는 DB 직접 접근 금지",
  "  • 비즈니스 로직을 Service 로 옮기고 controller 에서는 service.method() 호출",
  "  • 룰: docs/rules/backend/service-impl.md",
] as const;
