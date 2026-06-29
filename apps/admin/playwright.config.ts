import { defineConfig } from "@playwright/test";

/**
 * apps/admin E2E config.
 *
 * Spec 들은 tag 로 분류된다 (docs/runbooks/e2e-management.md 참고):
 *   - @critical  : 깨지면 admin 운영 못함 — main 게이트
 *   - @smoke     : 빠른 위생 (≤30s) — PR 게이트
 *   - @regression: 회귀 방지 — main 게이트
 */
const grep = process.env.PLAYWRIGHT_GREP
  ? new RegExp(process.env.PLAYWRIGHT_GREP)
  : undefined;
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
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  grep,
  grepInvert,
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
