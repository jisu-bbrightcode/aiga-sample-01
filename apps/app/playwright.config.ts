import { defineConfig } from "@playwright/test";

/**
 * apps/app E2E config.
 *
 * Spec 들은 tag 로 분류된다 (docs/runbooks/e2e-management.md 참고):
 *   - @critical  : 깨지면 사용자가 핵심 기능 못 씀 — main 게이트
 *   - @smoke     : 빠른 위생 (≤30s) — PR 게이트
 *   - @regression: 회귀 방지, 도메인별 — main 게이트
 *   - @db        : real PG branch 필요 — e2e-against-pg-branch workflow 에서만
 *
 * CI 에서 실행할 tag 는 `PLAYWRIGHT_GREP` env 또는 `--grep` 으로 선택한다.
 */
const grep = process.env.PLAYWRIGHT_GREP ? new RegExp(process.env.PLAYWRIGHT_GREP) : undefined;
const grepInvert = process.env.PLAYWRIGHT_GREP_INVERT
  ? new RegExp(process.env.PLAYWRIGHT_GREP_INVERT)
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    // 일부 spec 이 한국어 heading 텍스트로 엘리먼트 조회 —
    // CI chromium 의 default locale 은 en-US 라 "Welcome back" 이 렌더되어
    // "다시 오신..." 을 졤대 찾아주지 못함. 그래서 locale 을 ko-KR 로 고정.
    // (장기적으로는 spec 을 i18n-agnostic [data-el=...] selector 로 이전.)
    locale: "ko-KR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  grep,
  grepInvert,
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
