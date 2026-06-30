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
 *  - D3 (permission): an UNAUTHENTICATED visitor to a detail URL
 *    (/domain/doctor/:id) is likewise redirected to /sign-in
 *    (PB-ADMIN-DOMAIN-READ-001 / BBR-679).
 *  - D4 (detail): an authenticated admin opening a resource detail sees the
 *    operational-state + masked sensitive-info sections.
 *  - D5 (archive): the detail page exposes a 보관/복구 lifecycle action that opens
 *    a confirmation dialog before taking the resource off the public surface
 *    (PB-ADMIN-DOMAIN-DELETE-001 / BBR-682).
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

  test("D3: unauthenticated visit to a detail URL redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    // A representative detail path — the guard runs before any data fetch, so a
    // placeholder id is sufficient to prove the surface is gated.
    await page.goto("/domain/doctor/00000000-0000-0000-0000-000000000000");
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

  test("D4: opening a resource detail shows operational + masked sensitive sections", async ({
    page,
  }) => {
    // Navigate from the list into the first resource's detail page.
    const firstResource = page.locator('a[href^="/domain/"]').first();
    await expect(firstResource).toBeVisible({ timeout: 10_000 });
    await firstResource.click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\//, { timeout: 10_000 });
    // Operational state + sensitive (masked) sections are the read deliverable.
    await expect(page.getByText("운영 상태")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("민감 정보")).toBeVisible();
  });

  test("D5: detail exposes an archive/restore lifecycle action behind a confirm dialog", async ({
    page,
  }) => {
    const firstResource = page.locator('a[href^="/domain/"]').first();
    await expect(firstResource).toBeVisible({ timeout: 10_000 });
    await firstResource.click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\//, { timeout: 10_000 });

    // The lifecycle button is either 보관 (archive) or 복구 (restore) per current status.
    const lifecycleButton = page.getByRole("button", { name: /보관|복구/ });
    await expect(lifecycleButton).toBeVisible({ timeout: 10_000 });

    // Triggering it opens a confirmation dialog — exposure changes require intent.
    await lifecycleButton.click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/보관하시겠습니까|복구하시겠습니까/)).toBeVisible();
    // Cancelling leaves the resource untouched.
    await page.getByRole("button", { name: "취소" }).click();
  });
});
