// @ts-nocheck
/**
 * Mirror of `packages/oxlint-plugin/src/rules/no-local-css-import.mjs`.
 *
 * Forbid importing local .css from `apps/**` or `packages/widgets/**`. Use
 * Tailwind utility classes instead. Global stylesheet belongs to the app
 * entry point only.
 */

import { clip, type Violation } from "./lib.ts";

export const TARGET_PATH = /(?:^|\/)(?:apps|packages\/widgets)\/.*\.(?:ts|tsx)$/;
export const EXEMPT_PATH = /(?:^|\/)packages\/ui\/src\/_shadcn\//;

// Entry points may import the global stylesheet.
const ENTRY_FILES: readonly RegExp[] = [
  /(?:^|\/)apps\/[^/]+\/src\/main\.tsx?$/,
  /(?:^|\/)apps\/[^/]+\/src\/app\/.*layout\.tsx?$/,
];

// `import "./foo.css"`, `import "../foo.css"`, `import "@/foo.css"`,
// `import "~/foo.css"`. Non-relative (e.g. `import "katex/dist/katex.css"`)
// is allowed for vendor stylesheets — the lint rule's `LOCAL_PREFIX` mirrors
// this.
const LOCAL_CSS_IMPORT_RE =
  /\bimport\s+(?:[^;'"`]*\bfrom\s+)?["'](?:\.\.?\/|@\/|~\/|~)[^"']*\.css(?:\?[^"']*)?["']/g;

const DISABLE_COMMENT_RE =
  /(?:\/\/|\/\*)\s*(?:eslint|oxlint)-(?:disable(?:-(?:next-)?line)?|enable)\b[^*\n]*\bproduct-builder\/no-local-css-import\b/;

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!TARGET_PATH.test(path)) return false;
  if (EXEMPT_PATH.test(path)) return false;
  if (ENTRY_FILES.some((rx) => rx.test(path))) return false;
  return true;
}

export function findViolations(text: string): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;
  if (DISABLE_COMMENT_RE.test(text)) {
    const m = text.match(DISABLE_COMMENT_RE);
    out.push({ rule: "no-local-css-import", kind: "disable-comment", snippet: clip(m?.[0] ?? "") });
  }
  for (const m of text.matchAll(LOCAL_CSS_IMPORT_RE)) {
    out.push({ rule: "no-local-css-import", kind: "import", snippet: clip(m[0]) });
  }
  return out;
}

export const ADVICE = [
  "  • Local .css 파일 import 금지 (entry point 제외)",
  "  • Tailwind 유틸리티 클래스를 className 에 직접 사용",
  "  • 전역 스타일은 apps/<name>/src/main.tsx 또는 app/layout.tsx 에서만",
  "  • 룰: docs/rules/frontend/styling.md",
] as const;
