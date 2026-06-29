/**
 * no-e2e-anti-pattern
 *
 * apps/<app>/e2e/<file>.spec.ts 안의 Playwright spec 이 운영 규칙을 따르도록
 * 강제한다. 같은 규칙이 .pi/extensions/rules/e2e-spec-conventions.ts 에서
 * write-time 에 block 된다 — 두 파일을 항상 함께 수정할 것.
 *
 * 검출:
 *   • misplaced-e2e        — @playwright/test 를 e2e/ 밖에서 import
 *   • bad-filename         — kebab-case + 2+ 단어 아님 (apps/<app>/e2e 안)
 *   • generic-filename     — tests/e2e/feature/spec/index/sample/…
 *   • missing-level-tag    — 첫 describe/test title 에 @critical|@smoke|@regression 없음
 *   • multiple-level-tags  — 위 셋 중 2개 이상
 *   • missing-domain-tag   — @<도메인> tag (2글자+) 1개 이상 필수
 *   • cjk-selector         — getByRole(name:'<CJK>') / getByText('<CJK>') / …
 *   • wait-for-timeout     — page.waitForTimeout(...)
 *   • setTimeout-hack      — new Promise(setTimeout) / bare setTimeout
 *   • mock-required        — @db 없는 spec 이 page.goto('/...') 호출 시 page.route 0개
 *   • retry-hack           — test.describe.configure({ retries: > 1 })
 *   • skip-or-fail         — test.skip / test.fail
 */

const TARGET_PATH = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/.*\.spec\.ts$/;
const EXEMPT_PATH = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;
const TS_FILE = /\.(?:ts|tsx)$/;
const PLAYWRIGHT_IMPORT = /\bfrom\s+["']@playwright\/test["']/;

const CJK_CLASS = "[\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uac00-\\ud7af]";
const GET_BY_ROLE_NAME_CJK = new RegExp(
  `getByRole\\(\\s*["'\`][^"'\`]+["'\`]\\s*,\\s*\\{[^}]*\\bname\\s*:\\s*["'\`][^"'\`]*${CJK_CLASS}[^"'\`]*["'\`]`,
);
const GET_BY_TEXT_CJK = new RegExp(`getByText\\(\\s*["'\`][^"'\`]*${CJK_CLASS}[^"'\`]*["'\`]`);
const LOCATOR_TEXT_CJK = new RegExp(
  `\\.locator\\(\\s*["'\`]text=[^"'\`]*${CJK_CLASS}[^"'\`]*["'\`]`,
);
const HAS_TEXT_CJK = new RegExp(`\\bhasText\\s*:\\s*["'\`][^"'\`]*${CJK_CLASS}[^"'\`]*["'\`]`);

const WAIT_FOR_TIMEOUT = /\bpage\s*\.\s*waitForTimeout\s*\(/;
const SET_TIMEOUT_PROMISE_RE = /\bnew\s+Promise\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*setTimeout\s*\(/;
const BARE_SET_TIMEOUT = /\bsetTimeout\s*\(/g;
const SET_TIMEOUT_PROMISE_G = /\bnew\s+Promise\s*\(\s*(?:\([^)]*\)|\w+)\s*=>\s*setTimeout\s*\(/g;
const PAGE_GOTO = /\bpage\.goto\s*\(\s*["'`]\//g;
const PAGE_ROUTE = /\bpage\.route\s*\(/;
const DESCRIBE_RETRIES_RE_G = /test\.describe\.configure\s*\(\s*\{[^}]*\bretries\s*:\s*(\d+)/g;
// test.skip("title", fn) 의 영구 은닉만 차단. test.skip(cond, ...) 는 허용.
const TEST_SKIP_RE = /\btest\.(?:skip|fail)\s*\(\s*["'`]/;

const LEVEL_TAGS = ["@critical", "@smoke", "@regression"];
const DOMAIN_TAG_RE = /@(?!critical\b|smoke\b|regression\b|db\b)[a-z][a-z0-9-]+/g;

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
const KEBAB_2PLUS = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+\.spec\.ts$/;

function basename(p) {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

function isInsideE2eSpec(p) {
  return TARGET_PATH.test(p) && !EXEMPT_PATH.test(p);
}

function shouldGuard(filename) {
  if (!filename) return false;
  if (!TS_FILE.test(filename)) return false;
  if (EXEMPT_PATH.test(filename)) return false;
  return true;
}

function extractFirstTitle(text) {
  const reDescribe =
    /test\.describe(?:\.(?:serial|parallel|only|skip))?\s*\(\s*(["'`])([\s\S]*?)\1/;
  const reTest = /\btest(?:\.(?:only|skip|fixme|fail))?\s*\(\s*(["'`])([\s\S]*?)\1/;
  return text.match(reDescribe)?.[2] ?? text.match(reTest)?.[2];
}

const ADVICE_URL =
  "(no-e2e-anti-pattern; 또한 .pi/extensions/rules/e2e-spec-conventions.ts 와 동일)";

const noE2eAntiPattern = {
  meta: {
    name: "no-e2e-anti-pattern",
    type: "suggestion",
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";
    if (!shouldGuard(filename)) return {};

    return {
      Program(node) {
        const text = context.sourceCode?.text ?? context.getSourceCode?.().text ?? "";
        if (!text) return;
        const report = (msg) =>
          context.report({ node, message: `product-builder/no-e2e-anti-pattern: ${msg}` });

        // (A) e2e 외부 — misplaced 만 검사
        if (!isInsideE2eSpec(filename)) {
          if (PLAYWRIGHT_IMPORT.test(text)) {
            report(
              `@playwright/test 를 e2e/ 밖에서 import. 파일은 apps/<app>/e2e/ 안에 두세요. ${ADVICE_URL}`,
            );
          }
          return;
        }

        // (B) e2e 안 — 전체 룰

        // 파일 이름
        const base = basename(filename);
        if (base && !KEBAB_2PLUS.test(base)) {
          const root = base.replace(/\.spec\.ts$/, "");
          if (GENERIC_NAMES.has(root)) {
            report(
              `generic 파일 이름: ${base}. <feature>-<scenario>.spec.ts 형태로. ${ADVICE_URL}`,
            );
          } else {
            report(
              `파일 이름 형식 위반: ${base}. kebab-case + 2+ 단어 (예: auth-signin.spec.ts). ${ADVICE_URL}`,
            );
          }
        }

        // tag
        const title = extractFirstTitle(text);
        if (title !== undefined) {
          const levelHits = LEVEL_TAGS.filter((t) => title.includes(t));
          if (levelHits.length === 0) {
            report(
              `첫 describe/test title 에 @critical|@smoke|@regression 중 하나 필수. ${ADVICE_URL}`,
            );
          } else if (levelHits.length > 1) {
            report(`level tag 중복 (${levelHits.join(", ")}). ${ADVICE_URL}`);
          }
          const domainHits = title.match(DOMAIN_TAG_RE) ?? [];
          if (domainHits.length === 0) {
            report(`도메인 tag 없음 (@auth/@payment/@project 등 1개+ 필수). ${ADVICE_URL}`);
          }
        }

        // CJK selector
        if (GET_BY_ROLE_NAME_CJK.test(text)) {
          report(`getByRole({ name: '<CJK>' }) — data-el / data-testid 사용. ${ADVICE_URL}`);
        }
        if (GET_BY_TEXT_CJK.test(text)) {
          report(`getByText('<CJK>') — data-el / data-testid 사용. ${ADVICE_URL}`);
        }
        if (LOCATOR_TEXT_CJK.test(text)) {
          report(`.locator('text=<CJK>') — data-el / data-testid 사용. ${ADVICE_URL}`);
        }
        if (HAS_TEXT_CJK.test(text)) {
          report(`{ hasText: '<CJK>' } — data-el / data-testid 사용. ${ADVICE_URL}`);
        }

        // timing
        if (WAIT_FOR_TIMEOUT.test(text)) {
          report(`page.waitForTimeout(...) 금지. state-based 대기 사용. ${ADVICE_URL}`);
        }
        if (SET_TIMEOUT_PROMISE_RE.test(text)) {
          report(`new Promise(setTimeout) 우회 금지. ${ADVICE_URL}`);
        }
        const setTimeoutCount = (text.match(BARE_SET_TIMEOUT) || []).length;
        const promiseSetTimeoutCount = (text.match(SET_TIMEOUT_PROMISE_G) || []).length;
        if (setTimeoutCount > promiseSetTimeoutCount) {
          report(
            `setTimeout(...) 직접 호출 ${setTimeoutCount - promiseSetTimeoutCount}회 — state-based 대기 사용. ${ADVICE_URL}`,
          );
        }

        // mock-first 면제: @db, @design
        const isExempt = !title || title.includes("@db") || title.includes("@design");
        if (!isExempt) {
          const gotos = (text.match(PAGE_GOTO) || []).length;
          const routes = PAGE_ROUTE.test(text) ? 1 : 0;
          if (gotos > 0 && routes === 0) {
            report(
              `page.goto('/...') 가 있는데 page.route(...) mock 0개 — backend 의존이면 title 에 @db 추가, 아니면 mock 작성. ${ADVICE_URL}`,
            );
          }
        }

        // flake hack
        for (const m of text.matchAll(DESCRIBE_RETRIES_RE_G)) {
          if (Number(m[1]) > 1) {
            report(
              `test.describe.configure({ retries: ${m[1]} }) — flake 은닉 금지. 1 이하만. ${ADVICE_URL}`,
            );
          }
        }
        if (TEST_SKIP_RE.test(text)) {
          report(`test.skip / test.fail — 실패 은닉 금지. fix 하거나 spec 제거. ${ADVICE_URL}`);
        }
      },
    };
  },
};

export { noE2eAntiPattern };
