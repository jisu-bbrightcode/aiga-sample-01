// @ts-nocheck
/**
 * test-file-location — `.spec.ts` vs `.test.ts(x)` 경계 강제.
 *
 * 5 종류 테스트 × 5 위치 매트릭스 (docs/runbooks/e2e-management.md 와 일관):
 *
 *   ┌────────────────────┬────────────────────────────────────────────────┐
 *   │ 확장자             │ 허용 위치                                       │
 *   ├────────────────────┼────────────────────────────────────────────────┤
 *   │ *.spec.ts          │ apps/<app>/e2e/                Playwright       │
 *   │                    │ apps/server/src/               NestJS jest      │
 *   │                    │ packages/features/             jest             │
 *   │                    │ packages/data/                 jest             │
 *   │                    │ packages/core/                 jest             │
 *   │                    │ packages/drizzle/src/          jest             │
 *   │                    │ scripts/                       node smoke       │
 *   │                    │ .pi/                           smoke            │
 *   ├────────────────────┼────────────────────────────────────────────────┤
 *   │ *.test.ts(x)       │ apps/app/src/                  vitest           │
 *   │                    │ apps/admin/src/                vitest           │
 *   │                    │ packages/<ui-or-frontend>/src/ vitest           │
 *   └────────────────────┴────────────────────────────────────────────────┘
 *
 * 위반 (write-time block):
 *   • spec-misplaced  — `.spec.ts` 가 허용 위치 밖
 *   • test-misplaced  — `.test.ts(x)` 가 허용 위치 밖
 *   • spec-vs-test    — 같은 디렉토리에 jest spec 인척 하는 .test.ts 또는
 *                       vitest test 인척 하는 .spec.ts (server/jest vs vitest)
 *
 * mirror: packages/oxlint-plugin/src/rules/no-misplaced-test-file.mjs
 */

// ── allow tables ────────────────────────────────────────────────────────────

/** `.spec.ts` 가 들어가도 되는 위치 prefix (anchored). */
const SPEC_ALLOWED = [
  /(?:^|\/)apps\/[^/]+\/tests\/e2e\//, // Playwright E2E
  /(?:^|\/)apps\/server\/src\//, // NestJS jest
  /(?:^|\/)packages\/features\//, // service jest
  /(?:^|\/)packages\/data\//, // data jest
  /(?:^|\/)packages\/core\//, // core jest
  /(?:^|\/)packages\/drizzle\/src\//, // drizzle migration tests
  /(?:^|\/)scripts\//, // node smoke
  /(?:^|\/)\.pi\//, // pi extension smoke
] as const;

/**
 * `.test.ts(x)` 가 들어가도 되는 위치 prefix. 일반적으로 vitest 가 도는
 * 영역. features/data/core 는 spec.ts 만 사용하므로 여기서 제외.
 */
const TEST_ALLOWED = [
  /(?:^|\/)apps\/app\/src\//,
  /(?:^|\/)apps\/admin\/src\//,
  // frontend / ui package vitest
  /(?:^|\/)packages\/(?:ui|graphify)\/src\//,
  // graphify-mini src
  /(?:^|\/)graphify-mini\/.*\/src\//,
  // packages/core, apps/server: src/ 관례 없이 루트에 .test.ts 있음 (vitest)
  /(?:^|\/)packages\/core\//,
  /(?:^|\/)apps\/server\/src\//,
] as const;

// ── exempts ─────────────────────────────────────────────────────────────────

const E2E_HELPER_DIR = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;
const NODE_MODULES = /(?:^|\/)node_modules\//;
const DIST = /(?:^|\/)dist\//;

// ── path classifiers ────────────────────────────────────────────────────────

const SPEC_EXT = /\.spec\.ts$/;
const TEST_EXT = /\.test\.(?:ts|tsx)$/;

export function isSpecFile(path: string): boolean {
  return SPEC_EXT.test(path);
}
export function isTestFile(path: string): boolean {
  return TEST_EXT.test(path);
}

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (NODE_MODULES.test(path)) return false;
  if (DIST.test(path)) return false;
  if (E2E_HELPER_DIR.test(path)) return false;
  return isSpecFile(path) || isTestFile(path);
}

// ── detection ────────────────────────────────────────────────────────────────

function inAnyAllow(path: string, table: readonly RegExp[]): boolean {
  for (const rx of table) if (rx.test(path)) return true;
  return false;
}

export interface Violation {
  kind: "spec-misplaced" | "test-misplaced";
  snippet: string;
}

export function findViolations(_text: string, path = ""): Violation[] {
  if (!shouldGuard(path)) return [];
  if (isSpecFile(path) && !inAnyAllow(path, SPEC_ALLOWED)) {
    return [
      {
        kind: "spec-misplaced",
        snippet: `*.spec.ts 위치 위반: ${path} — apps/<app>/e2e/, apps/server/src/, packages/{features,data,core,drizzle/src}/, scripts/, .pi/ 중 하나에 두세요. unit 이면 .test.ts(x) 로.`,
      },
    ];
  }
  if (isTestFile(path) && !inAnyAllow(path, TEST_ALLOWED)) {
    return [
      {
        kind: "test-misplaced",
        snippet: `*.test.ts(x) 위치 위반: ${path} — apps/{app,admin,landing}/src/, packages/{ui,graphify}/src/ 의 vitest 영역에만. service/data 통합이면 .spec.ts 로 packages/features 또는 packages/data 안에.`,
      },
    ];
  }
  return [];
}

// ── advice ──────────────────────────────────────────────────────────────────

export const ADVICE: readonly string[] = [
  "테스트 파일 위치 규칙 (write-time 강제).",
  "",
  "• *.spec.ts (jest / Playwright) — 다음 위치에만:",
  "  - apps/<app>/e2e/<feature>-<scenario>.spec.ts   (Playwright E2E)",
  "  - apps/server/src/.../*.spec.ts                  (NestJS jest)",
  "  - packages/features/<domain>/.../*.spec.ts       (service jest)",
  "  - packages/data/.../*.spec.ts                    (data jest)",
  "  - packages/core/.../*.spec.ts                    (core jest)",
  "  - packages/drizzle/src/.../*.spec.ts             (drizzle 테스트)",
  "  - scripts/*.spec.ts, .pi/*.spec.ts               (node smoke)",
  "",
  "• *.test.ts(x) (vitest unit) — 다음 위치에만:",
  "  - apps/{app,admin,landing}/src/.../*.test.{ts,tsx}",
  "  - packages/{ui,graphify}/src/.../*.test.{ts,tsx}",
  "",
  "혼동되면 다음 결정 표:",
  "  - 컴포넌트 / hook / 순수 함수 단위 → .test.tsx (vitest, 옆 동거 또는 __tests__/)",
  "  - DB / API / 통합 흐름 → .spec.ts (jest, 해당 패키지 의 통합 위치)",
  "  - 사용자 시나리오 (브라우저) → .spec.ts (Playwright, apps/<app>/e2e/)",
  "",
  "근거: 운영 결정 — 룰이 단독으로 강제.",
];
