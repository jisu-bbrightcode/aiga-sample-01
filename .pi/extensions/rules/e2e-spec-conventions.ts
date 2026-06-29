// @ts-nocheck
/**
 * Shared rule data + detection logic for "E2E spec conventions".
 *
 * 새 Playwright spec / e2e 코드가 운영 규칙을 안 따르면 write-time 에 차단.
 *
 * 강제 규칙:
 *   1. 위치 (path):
 *      • spec 은 반드시 `apps/<app>/e2e/<feature>-<scenario>.spec.ts` 안에.
 *      •`apps/<app>/e2e/_*` (helpers/_lib/_mocks/_pages) 는 spec 아님 → 통과.
 *      • `@playwright/test` 를 import 하는 다른 위치의 파일은 misplaced-e2e 로 차단.
 *   2. 파일 이름 (filename):
 *      • <feature>-<scenario>.spec.ts 형태 (kebab-case + 2+ 단어 hyphen).
 *      • generic 이름 (tests, e2e, feature, spec, index, sample) 차단.
 *   3. tag:
 *      • 첫 test.describe / test 의 title 에 @critical|@smoke|@regression
 *        중 정확히 하나.
 *      • + 도메인 tag (@auth, @payment, …) 1개 이상.
 *      • @db 는 선택 — 있으면 e2e-against-pg-branch 로 라우팅.
 *   4. selector — i18n-agnostic:
 *      • getByRole({ name: '<CJK>' }) / getByText('<CJK>') /
 *        .locator('text=<CJK>') / { hasText: '<CJK>' } 차단.
 *   5. timing — state-based:
 *      • page.waitForTimeout(...) 차단.
 *      • await new Promise(r => setTimeout(r, ...)) 차단.
 *      • setTimeout 호출 단독 차단 (spec 안에서).
 *   6. mock-first:
 *      • @db 가 없는 spec 이 page.goto('/...') 만 부르고 page.route(...) 가
 *        0회면 backend 의존 의심 → block. 직접 mock 작성하거나 @db 추가.
 *   7. flake hack:
 *      • test.describe.configure({ retries: N }) 에서 N > 1 차단.
 *      • test.skip / test.fail 차단 (skip 으로 fail 은닉 금지).
 *
 * mirror: packages/oxlint-plugin/src/rules/no-e2e-anti-pattern.mjs
 */

// ── target / exempt path matchers ────────────────────────────────────────────

/** apps/<app>/e2e/<anything>.spec.ts — Playwright 의 default testRegex. */
export const TARGET_PATH = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/.*\.spec\.ts$/;

/** apps/<app>/e2e/_lib|_pages|_mocks/... — helpers, spec 아님. */
export const EXEMPT_PATH = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;

/**
 * `@playwright/test` 를 import 하는데 e2e 디렉토리 밖에 있는 파일.
 * (vitest *.test.tsx 는 @playwright/test 안 씀 → 안 잡힘)
 */
export const PLAYWRIGHT_IMPORT = /\bfrom\s+["']@playwright\/test["']/;

/** 일반 spec 파일 안의 ts/tsx. spec 검사에 안 쓰이는 *.ts/tsx 만 */
const TS_FILE = /\.(?:ts|tsx)$/;

export function shouldGuard(path: string): boolean {
  if (!path) return false;
  if (!TS_FILE.test(path)) return false;
  if (EXEMPT_PATH.test(path)) return false;
  // spec 위치는 강제 룰 모두 적용. e2e 외부 .ts/.tsx 는 misplaced 검사만.
  return true;
}

/** spec 위치 안에 있는가 (full rule set 적용 대상). */
function isInsideE2eSpec(path: string): boolean {
  return TARGET_PATH.test(path) && !EXEMPT_PATH.test(path);
}

// ── detection patterns ──────────────────────────────────────────────────────

const LEVEL_TAGS = ["@critical", "@smoke", "@regression"] as const;

/** 도메인 tag (free-form 이지만 최소 1 개 있어야 함). */
const DOMAIN_TAG_RE = /@(?!critical\b|smoke\b|regression\b|db\b)[a-z][a-z0-9-]+/g;

/** generic 파일 이름 차단 목록 (basename, .spec.ts 제외). */
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

/** kebab-case + 2+ 단어 hyphen 필수. */
const KEBAB_2PLUS = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+\.spec\.ts$/;

export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

/** 첫 describe 또는 첫 test 의 title 을 뽑는다. */
export function extractFirstTitle(text: string): string | undefined {
  const reDescribe =
    /test\.describe(?:\.(?:serial|parallel|only|skip))?\s*\(\s*(["'`])([\s\S]*?)\1/;
  const reTest = /\btest(?:\.(?:only|skip|fixme|fail))?\s*\(\s*(["'`])([\s\S]*?)\1/;
  return text.match(reDescribe)?.[2] ?? text.match(reTest)?.[2];
}

/** CJK (한·중·일) 가 들어 있는 문자열 selector 패턴. */
const CJK = "[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]";
const GET_BY_ROLE_NAME_CJK = new RegExp(
  `getByRole\\(\\s*["'\`][^"'\`]+["'\`]\\s*,\\s*\\{[^}]*\\bname\\s*:\\s*["'\`][^"'\`]*${CJK}[^"'\`]*["'\`]`,
  "g",
);
const GET_BY_TEXT_CJK = new RegExp(`getByText\\(\\s*["'\`][^"'\`]*${CJK}[^"'\`]*["'\`]`, "g");
const LOCATOR_TEXT_CJK = new RegExp(
  `\\.locator\\(\\s*["'\`]text=[^"'\`]*${CJK}[^"'\`]*["'\`]`,
  "g",
);
const HAS_TEXT_CJK = new RegExp(`\\bhasText\\s*:\\s*["'\`][^"'\`]*${CJK}[^"'\`]*["'\`]`, "g");

// timing
const WAIT_FOR_TIMEOUT = /\bpage\s*\.\s*waitForTimeout\s*\(/g;
const SET_TIMEOUT_PROMISE = /\bnew\s+Promise\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*setTimeout\s*\(/g;
// (?<![.\w]) 으로 test.setTimeout / page.setTimeout / global.setTimeout 등은 제외
const BARE_SET_TIMEOUT = /(?<![.\w])setTimeout\s*\(/g;

// mock-first (heuristic)
const PAGE_GOTO = /\bpage\.goto\s*\(\s*["'`]\//g;
const PAGE_ROUTE = /\bpage\.route\s*\(/g;

// flake hacks
const DESCRIBE_RETRIES_RE = /test\.describe\.configure\s*\(\s*\{[^}]*\bretries\s*:\s*(\d+)/g;
/**
 * test.skip / test.fail 영구 은닉 차단.
 * 첫 arg 가 string literal (single/double/backtick) 일 때만 영구 skip —
 * runtime conditional (test.skip(cond, "reason")) 은 허용 (env-gated).
 */
const TEST_SKIP_RE = /\btest\.(?:skip|fail)\s*\(\s*["'`]/g;

export interface Violation {
  kind:
    | "misplaced-e2e"
    | "bad-filename"
    | "generic-filename"
    | "missing-level-tag"
    | "multiple-level-tags"
    | "missing-domain-tag"
    | "cjk-selector"
    | "wait-for-timeout"
    | "setTimeout-hack"
    | "mock-required"
    | "retry-hack"
    | "skip-or-fail";
  snippet: string;
}

// ── per-rule checks (split for cognitive-complexity budget) ────────────────

function checkMisplaced(text: string, path: string): Violation[] {
  if (!PLAYWRIGHT_IMPORT.test(text)) return [];
  return [
    {
      kind: "misplaced-e2e",
      snippet: `@playwright/test import → 파일은 apps/<app>/e2e/ 안에 있어야 함: ${path}`,
    },
  ];
}

function checkFilename(path: string): Violation[] {
  const base = basename(path);
  if (!base || KEBAB_2PLUS.test(base)) return [];
  const root = base.replace(/\.spec\.ts$/, "");
  if (GENERIC_NAMES.has(root)) {
    return [
      {
        kind: "generic-filename",
        snippet: `generic 파일 이름: ${base} — <feature>-<scenario>.spec.ts 형태로`,
      },
    ];
  }
  return [
    {
      kind: "bad-filename",
      snippet: `파일 이름 형식 위반: ${base} — kebab-case + 2+ 단어 (예: auth-signin.spec.ts)`,
    },
  ];
}

function checkTags(title: string): Violation[] {
  const out: Violation[] = [];
  const levelHits = LEVEL_TAGS.filter((t) => title.includes(t));
  if (levelHits.length === 0) {
    out.push({
      kind: "missing-level-tag",
      snippet: `describe/test title 에 @critical|@smoke|@regression 없음: "${title.slice(0, 80)}"`,
    });
  } else if (levelHits.length > 1) {
    out.push({
      kind: "multiple-level-tags",
      snippet: `level tag 중복 (${levelHits.join(", ")}): "${title.slice(0, 80)}"`,
    });
  }
  const domainHits = title.match(DOMAIN_TAG_RE) ?? [];
  if (domainHits.length === 0) {
    out.push({
      kind: "missing-domain-tag",
      snippet: `도메인 tag 없음 (@auth/@payment/@project 등 1개 이상 필수): "${title.slice(0, 80)}"`,
    });
  }
  return out;
}

function checkCjkSelectors(text: string): Violation[] {
  const out: Violation[] = [];
  const cjkPatterns: [string, RegExp][] = [
    ["getByRole-name", GET_BY_ROLE_NAME_CJK],
    ["getByText", GET_BY_TEXT_CJK],
    ["locator-text", LOCATOR_TEXT_CJK],
    ["hasText", HAS_TEXT_CJK],
  ];
  for (const [label, rx] of cjkPatterns) {
    for (const m of text.matchAll(rx)) {
      out.push({ kind: "cjk-selector", snippet: `[${label}] ${m[0].slice(0, 120)}` });
    }
  }
  return out;
}

function checkTiming(text: string): Violation[] {
  const out: Violation[] = [];
  for (const m of text.matchAll(WAIT_FOR_TIMEOUT)) {
    out.push({ kind: "wait-for-timeout", snippet: m[0] });
  }
  for (const m of text.matchAll(SET_TIMEOUT_PROMISE)) {
    out.push({
      kind: "setTimeout-hack",
      snippet: `${m[0].slice(0, 80)}… (new Promise + setTimeout 우회)`,
    });
  }
  // BARE_SET_TIMEOUT 은 위 promise 패턴과 겹칠 수 있어 후순위
  const setTimeoutCount = (text.match(BARE_SET_TIMEOUT) || []).length;
  const promiseSetTimeoutCount = (text.match(SET_TIMEOUT_PROMISE) || []).length;
  if (setTimeoutCount > promiseSetTimeoutCount) {
    out.push({
      kind: "setTimeout-hack",
      snippet: `setTimeout(...) 직접 호출 ${setTimeoutCount - promiseSetTimeoutCount}회 — state-based 대기 사용`,
    });
  }
  return out;
}

function checkMockFirst(text: string, path: string, title: string | undefined): Violation[] {
  // 면제 조건:
  //   • @db        — 진짜 backend 의존 (e2e-against-pg-branch)
  //   • @design    — 디자인 시스템 / 레이아웃 측정 (backend 안 호출)
  const isExempt = !title || title.includes("@db") || title.includes("@design");
  if (isExempt) return [];
  const goto = (text.match(PAGE_GOTO) || []).length;
  const route = (text.match(PAGE_ROUTE) || []).length;
  if (goto === 0 || route > 0) return [];
  return [
    {
      kind: "mock-required",
      snippet:
        "page.goto('/...') 호출이 있는데 page.route(...) mock 0개 — backend 의존 의심. " +
        "mock 추가하거나 title 에 @db 추가하세요.",
    },
  ];
}

function checkFlakeHacks(text: string): Violation[] {
  const out: Violation[] = [];
  for (const m of text.matchAll(DESCRIBE_RETRIES_RE)) {
    const n = Number(m[1]);
    if (n > 1) {
      out.push({
        kind: "retry-hack",
        snippet: `test.describe.configure({ retries: ${n} }) — flake 은닉 금지. 1 이하만.`,
      });
    }
  }
  for (const m of text.matchAll(TEST_SKIP_RE)) {
    out.push({
      kind: "skip-or-fail",
      snippet: `${m[0]}… — skip/fail 으로 실패 은닉 금지. fix 하거나 spec 자체 제거.`,
    });
  }

  return out;
}

export function findViolations(text: string, path = ""): Violation[] {
  if (!text) return [];
  if (!isInsideE2eSpec(path)) return checkMisplaced(text, path);
  const title = extractFirstTitle(text);
  return [
    ...checkFilename(path),
    ...(title === undefined ? [] : checkTags(title)),
    ...checkCjkSelectors(text),
    ...checkTiming(text),
    ...checkMockFirst(text, path, title),
    ...checkFlakeHacks(text),
  ];
}

// ── advice ──────────────────────────────────────────────────────────────────

export const ADVICE: readonly string[] = [
  "E2E 운영 규칙 (write-time 강제). 우회 불가.",
  "",
  "• 위치: apps/<app>/e2e/<feature>-<scenario>.spec.ts",
  "  - <feature> = 도메인 (auth, payment, project, quest, …)",
  "  - <scenario> = 사용자 의도 1개 (sign-in, plan-change, crud-restore, …)",
  "  - generic 이름 (tests/e2e/feature/spec/index/sample) 금지",
  "  - @playwright/test 를 e2e/ 밖에서 import 하면 misplaced-e2e",
  "",
  "• tag: 첫 test.describe(...) title 끝에",
  "  - @critical | @smoke | @regression 중 정확히 1개 (level)",
  "  - 도메인 tag (@auth, @payment, …) 1개 이상",
  "  - mock 안 되면 @db 추가 (e2e-against-pg-branch 로 라우팅됨)",
  '  - 예: test.describe("Auth sign-in @critical @auth", () => { … })',
  "",
  "• selector: CJK 하드코딩 금지. CI chromium 은 en-US.",
  "  - 좋음: page.locator('[data-el=\"login.submit-btn\"]')",
  "  - 나쁨: page.getByRole('button', { name: '로그인' })",
  '  - UI 에 selector 없으면 컴포넌트 PR 에 data-el="<feature>.<elem>" 부착 먼저.',
  "",
  "• timing: state-based 대기.",
  "  - 좋음: await expect(page.locator(...)).toBeVisible()",
  "  - 좋음: await page.waitForURL('/home')",
  "  - 나쁨: page.waitForTimeout(2000)",
  "  - 나쁨: await new Promise(r => setTimeout(r, 2000))",
  "  - 나쁨: setTimeout(...) (spec 안에서)",
  "",
  "• mock-first: @db 없는 spec 이 page.goto('/...') 호출 시 page.route(...) 1개 이상 필수.",
  "  진짜 backend 호출이 필요하면 title 에 @db 추가.",
  "",
  "• DRY/helper: 기존 E2E helper 를 import.",
  "  - apps/app/tests/e2e/_lib/{env,auth,workspace,network,auth-mock,auth-fixture}.ts",
  "  - apps/electron/tests/e2e/_harness/dev-server.ts",
  "  - signIn/appUrl/fulfillJson/createAuthFixture/startAppDevServer 재선언 금지.",
  "",
  "• flake hack 금지:",
  "  - test.describe.configure({ retries: > 1 }) 금지 (1 이하만)",
  "  - test.skip / test.fail 로 실패 은닉 금지 (spec 자체를 제거하든가 fix)",
  "",
  "근거: 운영 결정 — 이 룰은 docs 없이 단독으로 강제됨.",
];
