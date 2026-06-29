// @ts-nocheck
/**
 * jotai-state-policy — browser React local state defaults to Jotai.
 *
 * Blocks new alternative client state managers and direct persisted browser
 * state calls in React/browser source. Persist feature state with Jotai utils
 * instead of hand-rolled localStorage/sessionStorage access.
 */

interface Violation {
  rule: string;
  kind: string;
  snippet: string;
}

function clip(s: string, n = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

const TARGET_PATHS: readonly RegExp[] = [
  /(?:^|\/)apps\/(?:app|admin|ai-runtime)\/src\/.*\.(?:ts|tsx|js|jsx)$/,
  /(?:^|\/)packages\/(?:core|shared|ui|widgets)\/src\/.*\.(?:ts|tsx|js|jsx)$/,
];

const EXEMPT_PATHS: readonly RegExp[] = [
  /(?:^|\/)__tests__\//,
  /(?:^|\/)tests?\//,
  /\.test\.(?:ts|tsx|js|jsx)$/,
  /(?:^|\/)setup\.(?:ts|tsx|js|jsx)$/,
];

const BANNED_STATE_MANAGERS = [
  "zustand",
  "redux",
  "@reduxjs/toolkit",
  "react-redux",
  "valtio",
  "recoil",
  "mobx",
  "mobx-react-lite",
  "nanostores",
  "@nanostores/react",
  "effector",
  "xstate",
] as const;

const BANNED_IMPORT_SOURCE = BANNED_STATE_MANAGERS.map((pkg) =>
  pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");

const BANNED_IMPORT_RE = new RegExp(
  String.raw`(?:^|[\n;])\s*(?:import|export)\s+(?:type\s+)?(?:[^;\n]*?\s+from\s+)?["'](` +
    BANNED_IMPORT_SOURCE +
    String.raw`)(?:\/[^"']*)?["']|\bimport\s*\(\s*["'](` +
    BANNED_IMPORT_SOURCE +
    String.raw`)(?:\/[^"']*)?["']\s*\)|\brequire\s*\(\s*["'](` +
    BANNED_IMPORT_SOURCE +
    String.raw`)(?:\/[^"']*)?["']\s*\)`,
  "g",
);

const BROWSER_STORAGE_API_RE =
  /\b(?:(?:window|globalThis)\s*\.\s*)?(?:localStorage|sessionStorage)\s*(?:\?\.\s*(?:getItem|setItem|removeItem|clear)|\.\s*(?:getItem|setItem|removeItem|clear)|\[\s*["'](?:getItem|setItem|removeItem|clear)["']\s*\])\s*\(/g;

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!TARGET_PATHS.some((rx) => rx.test(path))) return false;
  if (EXEMPT_PATHS.some((rx) => rx.test(path))) return false;
  return true;
}

export function findViolations(text: string, path = ""): Violation[] {
  const out: Violation[] = [];
  if (!text) return out;
  if (path && !shouldGuard(path)) return out;

  for (const m of text.matchAll(BANNED_IMPORT_RE)) {
    out.push({
      rule: "jotai-state-policy",
      kind: "state-manager-import",
      snippet: clip(m[0]),
    });
  }

  for (const m of text.matchAll(BROWSER_STORAGE_API_RE)) {
    out.push({
      rule: "jotai-state-policy",
      kind: "browser-storage-api",
      snippet: clip(m[0]),
    });
  }

  return out;
}

export const ADVICE = [
  "  • Browser React local/feature state default: Jotai.",
  "  • Persist browser feature state with `atomWithStorage` from `jotai/utils`.",
  "  • Use `createJSONStorage` for sessionStorage/custom storage and SSR-safe getters.",
  "  • Use `RESET` from `jotai/utils` to remove a persisted atom value.",
  "  • Ask before adding Zustand/Redux/MobX/Recoil/XState/etc. state-management deps.",
] as const;
