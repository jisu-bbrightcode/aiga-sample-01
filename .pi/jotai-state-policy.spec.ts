import assert from "node:assert/strict";
import test from "node:test";

import { ADVICE, findViolations, shouldGuard } from "./extensions/rules/jotai-state-policy.ts";
import { inspect } from "./extensions/no-banned-patterns/index.ts";

const guardedPath = "apps/app/src/features/preferences/useTheme.tsx";

test("guards browser React source paths only", () => {
  assert.equal(shouldGuard(guardedPath), true);
  assert.equal(shouldGuard("apps/app/src/features/preferences/useTheme.test.tsx"), false);
  assert.equal(shouldGuard("apps/app/tests/e2e/preferences.spec.ts"), false);
  assert.equal(shouldGuard("docs/reference/tooling.md"), false);
  assert.equal(shouldGuard("apps/server/src/preferences.ts"), false);
  assert.equal(shouldGuard("packages/features/story/src/state.ts"), false);
  assert.equal(shouldGuard("packages/shared/src/store/auth.ts"), true);
  assert.equal(shouldGuard("packages/core/src/i18n/language-store.ts"), true);
  assert.equal(shouldGuard("apps/ai-runtime/src/app/page.tsx"), true);
});

test("flags alternative browser state managers but allows Jotai", () => {
  assert.deepEqual(findViolations('import { atom } from "jotai";', guardedPath), []);

  const violations = findViolations(
    'import { create } from "zustand";\nimport { Provider } from "react-redux";',
    guardedPath,
  );

  assert.equal(violations.length, 2);
  assert.equal(violations[0]?.kind, "state-manager-import");
  assert.match(violations[0]?.snippet ?? "", /zustand/);

  const requireViolations = findViolations('const create = require("zustand");', guardedPath);
  assert.equal(requireViolations.length, 1);
  assert.equal(requireViolations[0]?.kind, "state-manager-import");
});

test("flags direct browser persisted state APIs", () => {
  const violations = findViolations(
    "localStorage.getItem('theme');\nwindow.sessionStorage.setItem('draft', value);\nglobalThis.localStorage.clear();\nlocalStorage?.setItem('theme', 'dark');\nsessionStorage[\"removeItem\"]('draft');",
    guardedPath,
  );

  assert.equal(violations.length, 5);
  assert.deepEqual(
    violations.map((v) => v.kind),
    [
      "browser-storage-api",
      "browser-storage-api",
      "browser-storage-api",
      "browser-storage-api",
      "browser-storage-api",
    ],
  );
});

test("does not flag Jotai utils storage configuration", () => {
  const text = `
    import { atomWithStorage, createJSONStorage, RESET } from "jotai/utils";
    const storage = createJSONStorage(() =>
      typeof window !== "undefined" ? window.sessionStorage : undefined,
    );
    export const themeAtom = atomWithStorage("theme", "system", storage);
  `;

  assert.deepEqual(findViolations(text, guardedPath), []);
});

test("integrated write-time extension blocks Jotai state policy violations", () => {
  const result = inspect({
    toolName: "write",
    input: {
      path: guardedPath,
      content: 'import { create } from "zustand";\nlocalStorage.setItem("theme", "dark");',
    },
  });

  assert.equal(result?.block, true);
  assert.match(result?.reason ?? "", /jotai-state-policy/);
  assert.match(result?.reason ?? "", /zustand|localStorage/);
});

test("policy advice advertises Jotai state guidance without repo-local skills", () => {
  const advice = ADVICE.join("\n");

  assert.match(advice, /Jotai/);
  assert.match(advice, /atomWithStorage/);
  assert.match(advice, /createJSONStorage/);
  assert.match(advice, /RESET/);
  assert.doesNotMatch(advice, /\.pi\/skills/);
});
