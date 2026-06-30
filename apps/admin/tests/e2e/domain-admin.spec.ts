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
 *  - D6 (permission): an UNAUTHENTICATED visitor to /domain/new is redirected
 *    to /sign-in (PB-ADMIN-DOMAIN-CREATE-001 / BBR-680).
 *  - D7 (create): an authenticated admin on /domain/new sees the separated
 *    공개 정보 / 운영 정보 sections and required-field validation, and can
 *    submit a draft resource.
 *  - D8 (edit): the detail page exposes a 수정 action; the edit form pre-fills
 *    the record and saving returns to the detail
 *    (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
 *  - D9 (status + history): the detail page exposes publish/unpublish status
 *    actions behind a confirm dialog and a 변경 이력 (audit trail) section
 *    (PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681).
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

  test("D6: unauthenticated visit to /domain/new redirects to sign-in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/domain/new");
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

  test("D7: create form separates 공개/운영 sections and validates required fields", async ({
    page,
  }) => {
    await page.goto("/domain/new");
    await expect(page.getByRole("heading", { name: "도메인 리소스 생성" })).toBeVisible({
      timeout: 10_000,
    });
    // AC#1 — 공개 필드와 운영 필드 섹션이 분리되어 있다.
    await expect(page.getByText("공개 정보")).toBeVisible();
    await expect(page.getByText("운영 정보")).toBeVisible();
    // 운영 정보의 상태는 기본 draft(초안)이다.
    await expect(page.locator("#status")).toBeVisible();

    // Submitting empty surfaces required-field validation rather than posting.
    await page.getByRole("button", { name: "리소스 생성" }).click();
    await expect(page.getByText("이름을 입력해주세요.")).toBeVisible({ timeout: 5_000 });

    // A valid draft submission navigates to the new record's detail page.
    const unique = `e2e-doctor-${Date.now()}`;
    await page.fill("#name", "E2E 김의사");
    await page.fill("#slug", unique);
    await page.getByRole("button", { name: "리소스 생성" }).click();
    await expect(page).toHaveURL(/\/domain\/doctor\//, { timeout: 10_000 });
  });

  test("D8: detail exposes a 수정 action and the edit form pre-fills the record", async ({
    page,
  }) => {
    const firstResource = page.locator('a[href^="/domain/"]').first();
    await expect(firstResource).toBeVisible({ timeout: 10_000 });
    await firstResource.click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\//, { timeout: 10_000 });

    await page.getByRole("button", { name: "수정" }).click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\/.+\/edit/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "도메인 리소스 수정" })).toBeVisible();
    // The edit form pre-fills the existing name (non-empty slug/name).
    await expect(page.locator("#name")).not.toHaveValue("");
    // Saving returns to the detail page.
    await page.getByRole("button", { name: "변경 사항 저장" }).click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\/[^/]+$/, { timeout: 10_000 });
  });

  test("D9: detail exposes status actions behind a confirm dialog + a 변경 이력 section", async ({
    page,
  }) => {
    const firstResource = page.locator('a[href^="/domain/"]').first();
    await expect(firstResource).toBeVisible({ timeout: 10_000 });
    await firstResource.click();
    await expect(page).toHaveURL(/\/domain\/(doctor|hospital)\//, { timeout: 10_000 });

    // 변경 이력 (audit trail) section is always present on the detail page.
    await expect(page.getByText("변경 이력")).toBeVisible({ timeout: 10_000 });

    // A publish/unpublish action (공개 or 비공개 전환) sits next to the lifecycle
    // buttons; triggering it asks for confirmation before changing exposure.
    const statusButton = page.getByRole("button", { name: /^공개$|비공개 전환/ }).first();
    await expect(statusButton).toBeVisible({ timeout: 10_000 });
    await statusButton.click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
    // Cancelling leaves the status untouched.
    await page.getByRole("button", { name: "취소" }).click();
  });
});
