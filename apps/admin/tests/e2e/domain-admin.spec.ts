/**
 * Domain (의사/병원) Admin — list/search e2e + permission gate.
 *
 * PB-ADMIN-DOMAIN-LIST-001 / BBR-678.
 *
 * NOTE — Playwright is not yet wired into the monorepo (see payment-admin.spec.ts).
 * This spec is checked in alongside the feature so the permission + list test
 * plan lives next to the code; it runs once the e2e harness lands:
 *   1. `pnpm --filter admin add -D @playwright/test`
 *   2. `pnpm --filter admin exec playwright install --with-deps chromium`
 *   3. boot the server (:3002) + admin (:3001), then `pnpm --filter admin e2e`.
 *
 * Coverage:
 *  - D0 (permission): an UNAUTHENTICATED visitor to /domain is redirected to
 *    /sign-in by AdminGuard — the protected admin surface is never exposed.
 *  - D1 (list): an authenticated admin loads /domain and sees the list shell.
 *  - D2 (filter): the search + status/type filter controls are present.
 */
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "qa@example.com";
const ADMIN_PASSWORD = "m55nSh5t$$";
const SERVER_URL = "http://localhost:3002";

test.describe("Domain Admin — permission gate @critical @admin @domain", () => {
  test("D0: unauthenticated visit to /domain redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/domain");
    // AdminGuard sends unauthenticated users to /sign-in.
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
  });
});

test.describe("Domain Admin — list/search (qa@example.com) @admin @domain @db", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill("input[type=email]", ADMIN_EMAIL);
    await page.fill("input[type=password]", ADMIN_PASSWORD);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/sign-in") && r.status() === 200, {
        timeout: 10_000,
      }),
      page.click('button:has-text("관리자 로그인")'),
    ]);
    await page.evaluate(async (serverUrl) => {
      await fetch(`${serverUrl}/api/auth/organization/set-active`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationSlug: "product-builder-admin" }),
      });
    }, SERVER_URL);
    await page.goto("/domain");
    await page.waitForLoadState("networkidle");
  });

  test("D1: domain list page renders its shell", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "도메인 리소스" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("리소스 목록")).toBeVisible();
  });

  test("D2: search + filter controls are present", async ({ page }) => {
    await expect(page.locator("#domain-search")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#domain-type")).toBeVisible();
    await expect(page.locator("#domain-status")).toBeVisible();
  });
});
