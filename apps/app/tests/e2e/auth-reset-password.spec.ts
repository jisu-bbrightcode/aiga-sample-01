/**
 * Auth reset-password E2E — 비밀번호 재설정 흐름.
 * 모든 `/api/auth/**` 는 mock — 외부 인프라 의존 없음.
 *
 * 시나리오:
 * 1. 유효한 토큰 + 성공 응답 → /sign-in 으로 이동
 * 2. 비밀번호 불일치 → 에러 메시지, 페이지 유지
 * 3. 토큰 없는 진입 → 토큰 에러 표시, submit 비활성화
 * 4. 서버 오류 응답 → 에러 메시지 표시
 */
import { expect, test, type Page } from "@playwright/test";

import { type AuthRequest, parsePostData } from "./_lib/auth-mock";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const VALID_TOKEN = "e2e-reset-token-valid";
const NEW_PASSWORD = "NewPassword123!";




async function installAuthMock(page: Page, scenario: "success" | "error", requests: AuthRequest[]) {
  await page.route("**/auth/**", async (route) => {
    const request = route.request();
    const url = request.url();
    requests.push({ method: request.method(), url, postData: parsePostData(route) });

    if (url.includes("reset-password")) {
      if (scenario === "error") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "INVALID_TOKEN", message: "Invalid or expired token" },
          }),
        });
        return;
      }
      await fulfillJson(route, { status: true });
      return;
    }

    await fulfillJson(route, null);
  });
}

test.describe("Reset password @regression @auth", () => {
  test("유효한 토큰으로 비밀번호 변경 성공 시 /sign-in 으로 이동", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "success", requests);

    await page.goto(appUrl(`/reset-password?token=${VALID_TOKEN}`), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-el="reset.form-card"]')).toBeVisible();

    await page.locator('[data-el="reset.new-password-input"]').fill(NEW_PASSWORD);
    await page.locator('[data-el="reset.confirm-password-input"]').fill(NEW_PASSWORD);
    await page.locator('[data-el="reset.submit"]').click();

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5_000 });

    const resetRequest = requests.find((r) => r.url.includes("reset-password"));
    expect(resetRequest?.method).toBe("POST");
    expect(resetRequest?.postData).toEqual(
      expect.objectContaining({ newPassword: NEW_PASSWORD, token: VALID_TOKEN }),
    );
  });

  test("비밀번호 불일치 시 에러 메시지 표시 + 페이지 유지", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "success", requests);

    await page.goto(appUrl(`/reset-password?token=${VALID_TOKEN}`), {
      waitUntil: "domcontentloaded",
    });

    await page.locator('[data-el="reset.new-password-input"]').fill(NEW_PASSWORD);
    await page.locator('[data-el="reset.confirm-password-input"]').fill("DifferentPassword123!");
    await page.locator('[data-el="reset.submit"]').click();

    await expect(page.locator('[data-el="reset.error-message"]')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
    // API 호출 없음
    expect(requests.find((r) => r.url.includes("reset-password"))).toBeUndefined();
  });

  test("토큰 없이 진입 시 토큰 에러 표시 + submit 비활성화", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "success", requests);

    await page.goto(appUrl("/reset-password"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-el="reset.error-message"]')).toBeVisible();
    await expect(page.locator('[data-el="reset.submit"]')).toBeDisabled();
  });

  test("서버 오류 응답 시 에러 메시지 표시 + 페이지 유지", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "error", requests);

    await page.goto(appUrl(`/reset-password?token=${VALID_TOKEN}`), {
      waitUntil: "domcontentloaded",
    });

    await page.locator('[data-el="reset.new-password-input"]').fill(NEW_PASSWORD);
    await page.locator('[data-el="reset.confirm-password-input"]').fill(NEW_PASSWORD);
    await page.locator('[data-el="reset.submit"]').click();

    await expect(page.locator('[data-el="reset.error-message"]')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });
});
