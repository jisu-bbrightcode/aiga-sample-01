/**
 * Email Templates Admin — list/create/detail + permission gate e2e.
 *
 * PB-NOTI-EMAIL-ADMIN-001 / BBR-662.
 *
 * NOTE — Playwright is not yet wired into the monorepo (see domain-admin.spec.ts
 * / payment-admin.spec.ts). This spec is checked in alongside the feature so the
 * permission + CRUD/test-send test plan lives next to the code; it runs once the
 * e2e harness lands:
 *   1. `pnpm --filter admin add -D @playwright/test`
 *   2. `pnpm --filter admin exec playwright install --with-deps chromium`
 *   3. boot the server (:3002) + admin (:3001), then `pnpm --filter admin e2e`.
 *
 * Coverage:
 *  - E0 (permission): an UNAUTHENTICATED visitor to /email-templates is
 *    redirected to /sign-in by AdminGuard — the protected admin surface is
 *    never exposed.
 *  - E1 (list): an authenticated admin loads /email-templates and sees the
 *    list shell + create entry point.
 *  - E2 (filter): search + category/active filter controls are present.
 *  - E3 (create): the "새 템플릿" dialog opens with the key/name/subject form.
 *  - E4 (detail/test-send): a template detail exposes 버전/미리보기/테스트 발송
 *    tabs (AC: CRUD + test-send reachable from the admin UI).
 */
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = "qa@example.com";
const ADMIN_PASSWORD = "m55nSh5t$$";
const SERVER_URL = "http://localhost:3002";

test.describe("Email Templates Admin — permission gate @critical @admin @email", () => {
  test("E0: unauthenticated visit to /email-templates redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/email-templates");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
  });
});

test.describe("Email Templates Admin — CRUD/test-send (qa@example.com) @admin @email @db", () => {
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
    await page.goto("/email-templates");
    await page.waitForLoadState("networkidle");
  });

  test("E1: templates list page renders its shell + create entry", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "이메일 템플릿" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("템플릿 목록")).toBeVisible();
    await expect(page.getByRole("button", { name: "새 템플릿" })).toBeVisible();
  });

  test("E2: search + filter controls are present", async ({ page }) => {
    await expect(page.locator("#template-search")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#template-category-filter")).toBeVisible();
    await expect(page.locator("#template-active-filter")).toBeVisible();
  });

  test("E3: create dialog exposes the template form", async ({ page }) => {
    await page.getByRole("button", { name: "새 템플릿" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#template-key")).toBeVisible();
    await expect(page.locator("#template-name")).toBeVisible();
    await expect(page.locator("#template-subject")).toBeVisible();
  });

  test("E4: template detail exposes preview + test-send tabs", async ({ page }) => {
    // Open the first template row's detail link, then assert the action tabs.
    const firstLink = page.locator('a[href^="/email-templates/"]').first();
    await firstLink.click();
    await expect(page.getByRole("tab", { name: "미리보기" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "테스트 발송" })).toBeVisible();
  });
});
