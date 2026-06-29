// @ts-nocheck
/**
 * Mirror of `packages/oxlint-plugin/src/rules/no-manual-memoization.mjs`.
 *
 * Disallow useMemo / useCallback / React.memo / bare `memo()` — React
 * Compiler memoizes automatically.
 *
 * No path scope — applies repo-wide to .ts/.tsx (oxlint rule does the same).
 */

import { clip, type Violation } from "./lib.ts";

export const TARGET_PATH = /\.(?:ts|tsx)$/;
export const EXEMPT_PATH =
  /(?:^|\/)(?:scripts|__tests__|packages\/oxlint-plugin|packages\/ui\/src\/_shadcn)\//;

const USE_MEMO_RE = /\b(?:React\s*\.\s*)?useMemo\s*\(/g;
const USE_CALLBACK_RE = /\b(?:React\s*\.\s*)?useCallback\s*\(/g;
// `memo(Component)` (bare) and `React.memo(Component)`. Avoid matching the
// word "memo" inside identifiers like `memoized`, `memoCache`.
const MEMO_RE = /\b(?:React\s*\.\s*)?memo\s*\(/g;

const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-manual-memoization\b/;

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!TARGET_PATH.test(path)) return false;
  if (EXEMPT_PATH.test(path)) return false;
  if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(path)) return false;
  return true;
}

export function findViolations(text: string): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;
  if (DISABLE_COMMENT_RE.test(text)) {
    const m = text.match(DISABLE_COMMENT_RE);
    out.push({
      rule: "no-manual-memoization",
      kind: "disable-comment",
      snippet: clip(m?.[0] ?? ""),
    });
  }
  for (const m of text.matchAll(USE_MEMO_RE)) {
    out.push({ rule: "no-manual-memoization", kind: "useMemo", snippet: clip(m[0]) });
  }
  for (const m of text.matchAll(USE_CALLBACK_RE)) {
    out.push({ rule: "no-manual-memoization", kind: "useCallback", snippet: clip(m[0]) });
  }
  for (const m of text.matchAll(MEMO_RE)) {
    // Exclude the two we already matched (`(?:React\.)?useMemo|useCallback`
    // also matches `memo` prefix). The previous regexes ended with `Memo(` /
    // `Callback(` so `memo(` is distinct, but `useMemo(` would also match
    // `/\bmemo\(/`. Trim those out:
    if (/use(?:Memo|Callback)/.test(m[0])) continue;
    out.push({ rule: "no-manual-memoization", kind: "memo", snippet: clip(m[0]) });
  }
  return out;
}

export const ADVICE = [
  "  • 이 프로젝트는 React Compiler 가 자동으로 memoize 함 (수동 불필요)",
  "  • useMemo / useCallback / memo() 모두 제거",
  "  • 룰: docs/rules/frontend/react-component.md §1",
] as const;
