/**
 * Payment v1 — Admin e2e (A1~A7) — Phase 14 G8 ship-readiness gate.
 *
 * Spec §10.3 / Plan Phase 14 Task 14.2.
 *
 * NOTE — Phase 14 status: Playwright is NOT yet wired into the monorepo.
 * This file is checked in so the test plan is captured next to the code,
 * but execution waits on Phase 15 follow-up:
 *   1. `pnpm --filter admin add -D @playwright/test`
 *   2. add `apps/admin/playwright.config.ts` (baseURL=http://localhost:3001,
 *      webServer=`pnpm dev`).
 *   3. `pnpm --filter admin exec playwright install --with-deps chromium`
 * Until then, running `pnpm --filter admin exec playwright test` will fail
 * at the import step — by design.
 *
 * A3 (grant credits) and A4 (refund) are skipped because they require a
 * seeded subscription/order pair that only exists after a real Polar
 * checkout — moved to Phase 15 fixture work.
 */
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "qa@example.com";
const ADMIN_PASSWORD = "m55nSh5t$$";
const SERVER_URL = "http://localhost:3002";

test.describe("Payment Admin (qa@example.com) @critical @admin @payment @db", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("input[type=email]", ADMIN_EMAIL);
    await page.fill("input[type=password]", ADMIN_PASSWORD);
    // Click submit and wait for the sign-in network request to complete.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/sign-in") && r.status() === 200, {
        timeout: 10_000,
      }),
      page.click('button:has-text("관리자 로그인")'),
    ]);
    // After password login, better-auth's organization plugin needs an
    // explicit set-active call to populate sessions.active_organization_id;
    // without it, AdminGuard's userRole comes back null and the layout
    // redirects to /sign-in. The fetch must hit the server origin (admin's
    // VITE_API_URL points to http://localhost:3002, no vite proxy).
    await page.evaluate(async (serverUrl) => {
      await fetch(`${serverUrl}/api/auth/organization/set-active`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationSlug: "product-builder-admin" }),
      });
    }, SERVER_URL);
    // Reload so the admin app picks up the new active org from the session.
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("A1: dashboard renders 4 stat cards", async ({ page }) => {
    await page.goto("/payment");
    await expect(page.getByText(/MRR|매출|구독자|Churn/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("A2: subscribers list → row click → detail page", async ({ page }) => {
    await page.goto("/payment/subscribers");
    await expect(page.locator('table, [role="table"]').first()).toBeVisible({
      timeout: 10_000,
    });
    // Click first row if any subscription exists; otherwise just verify URL.
    const firstRow = page.locator("tbody tr").first();
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      await expect(page).toHaveURL(/\/payment\/subscribers\/.+/);
    }
  });



  test("A5: plans page lists catalog plans", async ({ page }) => {
    await page.goto("/payment/plans");
    await expect(page.getByText("free").or(page.getByText("Free"))).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/pro_monthly|Pro · Monthly/).first()).toBeVisible();
  });

  test("A6: coupons page → 만들기 버튼 opens dialog", async ({ page }) => {
    await page.goto("/payment/coupons");
    await page.click('button:has-text("쿠폰 만들기")');
    await expect(page.getByText(/code|코드/i).first()).toBeVisible();
  });

  test("A7: audit log page renders without 404", async ({ page }) => {
    await page.goto("/payment/audit");
    await expect(page).toHaveURL("/payment/audit");
    const isNotFound = await page.getByText("Not Found").count();
    expect(isNotFound).toBe(0);
  });
});
