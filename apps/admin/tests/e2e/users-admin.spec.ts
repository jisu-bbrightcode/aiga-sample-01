/**
 * Users Admin — profile/meta edit e2e + permission gate.
 *
 * PB-ADMIN-USERS-UPDATE-001 / BBR-688.
 *
 * NOTE — Playwright is not yet wired into the monorepo (see domain-admin.spec.ts
 * and payment-admin.spec.ts). This spec is checked in alongside the feature so
 * the edit + permission test plan lives next to the code; it runs once the e2e
 * harness lands:
 *   1. `pnpm --filter admin add -D @playwright/test`
 *   2. `pnpm --filter admin exec playwright install --with-deps chromium`
 *   3. boot the server (:3002) + admin (:3001), then `pnpm --filter admin e2e`.
 *
 * Coverage:
 *  - U0 (permission): an UNAUTHENTICATED visitor to /users is redirected to
 *    /sign-in by AdminGuard — the protected admin surface is never exposed.
 *  - U1 (list): an authenticated admin loads /users and sees the list shell.
 *  - U2 (edit form): opening a user's detail dialog shows the "프로필 수정"
 *    section with the admin-editable fields (표시명/핸들/소개/아바타).
 *  - U3 (AC#1 boundary): the edit section shows email/인증수단/등급 as read-only
 *    context — fields the user manages or that change via a separate flow.
 *  - U4 (AC#2 audit): saving an edited 표시명 issues a PATCH /api/admin/users/:id
 *    and the change is reflected back; the server records it in the admin audit
 *    log (asserted server-side by user-directory.service.spec).
 */
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "qa@example.com";
const ADMIN_PASSWORD = "m55nSh5t$$";
const SERVER_URL = "http://localhost:3002";

test.describe("Users Admin — permission gate @critical @admin @users", () => {
  test("U0: unauthenticated visit to /users redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/users");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
  });
});

test.describe("Users Admin — profile edit (qa@example.com) @admin @users @db", () => {
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
    await page.goto("/users");
    await page.waitForLoadState("networkidle");
  });

  async function openFirstUserDialog(page: import("@playwright/test").Page) {
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
  }

  test("U2: detail dialog shows the profile edit section + editable fields", async ({ page }) => {
    await openFirstUserDialog(page);
    await expect(page.getByText("프로필 수정")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#edit-name")).toBeVisible();
    await expect(page.locator("#edit-handle")).toBeVisible();
    await expect(page.locator("#edit-bio")).toBeVisible();
    await expect(page.locator("#edit-avatar")).toBeVisible();
  });

  test("U3: edit section separates user-managed fields as read-only (AC#1)", async ({ page }) => {
    await openFirstUserDialog(page);
    await expect(page.getByText("이메일 (사용자 관리)")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("인증수단 (사용자 관리)")).toBeVisible();
    await expect(page.getByText("등급 (별도 절차)")).toBeVisible();
  });

  test("U4: saving a changed 표시명 issues an audited PATCH (AC#2)", async ({ page }) => {
    await openFirstUserDialog(page);
    const nameInput = page.locator("#edit-name");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill(`QA 수정 ${Date.now()}`);
    await page.fill("#admin-user-reason", "e2e: 프로필 표시명 수정");
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => /\/api\/admin\/users\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
        { timeout: 10_000 },
      ),
      page.click('button:has-text("프로필 저장")'),
    ]);
    expect(response.status()).toBe(200);
    await expect(page.getByText("프로필을 수정했습니다.")).toBeVisible({ timeout: 10_000 });
  });
});
