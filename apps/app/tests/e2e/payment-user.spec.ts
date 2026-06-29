/**
 * Payment v1 — User app e2e (U1~U6) — Phase 14 G8 ship-readiness gate.
 *
 * Spec §10.3 / Plan Phase 14 Task 14.3.
 *
 * NOTE — Phase 14 status: Playwright is NOT yet wired into the monorepo.
 * This file is checked in so the test plan is captured next to the code,
 * but execution waits on Phase 15 follow-up:
 *   1. `pnpm --filter app add -D @playwright/test`
 *   2. add `apps/app/playwright.config.ts` (baseURL=http://localhost:3000,
 *      webServer=`pnpm dev`).
 *   3. `pnpm --filter app exec playwright install --with-deps chromium`
 *
 * U2 (complete checkout) and U3 (top-up checkout completion) are skipped
 * because they require driving the Polar sandbox card flow on polar.sh —
 * moved to Phase 15 follow-up once a sandbox card / cookie-based bypass
 * is wired in.
 */
import { expect, test } from "@playwright/test";

import { signIn } from "./_lib/auth";

const QA_EMAIL = "qa@example.com";
const QA_PASSWORD = "m55nSh5t$$";


test.describe("Payment User @regression @payment @db", () => {
  test("U1 (anon): /pricing renders plan cards", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/Pro|Team/).first()).toBeVisible();
  });

  test("U1 (auth): /billing/upgrade → Pro 구독 → polar checkout URL", async ({
    page,
  }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });

    await page.goto("/billing/upgrade");
    await page.click('button:has-text("Pro")');
    // Navigation jumps off-app to polar.sh.
    await page.waitForURL(/polar\.sh\/checkout/, { timeout: 15_000 });
    expect(page.url()).toContain("polar.sh/checkout");
  });



  test("U5: /billing/usage renders for signed-in user", async ({ page }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });
    await page.goto("/billing/usage");
    await expect(page).toHaveURL("/billing/usage");
    const isNotFound = await page.getByText("Not Found").count();
    expect(isNotFound).toBe(0);
  });

  test("U6: /billing/invoices renders for signed-in user", async ({ page }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });
    await page.goto("/billing/invoices");
    await expect(page).toHaveURL("/billing/invoices");
    const isNotFound = await page.getByText("Not Found").count();
    expect(isNotFound).toBe(0);
  });
});
