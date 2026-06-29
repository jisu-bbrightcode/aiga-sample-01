/**
 * Auth forgot-password E2E — 재설정 메일 발송 흐름.
 * 모든 `/api/auth/**` 는 mock — 외부 메일 인프라 의존 없음.
 */
import { expect, test, type Page } from "@playwright/test";

import { type AuthRequest, parsePostData } from "./_lib/auth-mock";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const RESET_EMAIL = "e2e-forgot@studio.com";




async function installAuthMock(
  page: Page,
  scenario: "success" | "rate-limited",
  requests: AuthRequest[],
) {
  await page.route("**/auth/**", async (route) => {
    const request = route.request();
    const url = request.url();
    requests.push({ method: request.method(), url, postData: parsePostData(route) });

    if (url.includes("request-password-reset") || url.includes("forget-password")) {
      if (scenario === "rate-limited") {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "TOO_MANY_REQUESTS", message: "rate limited" },
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

test.describe("Forgot password @regression @auth", () => {
  test("이메일 입력 후 재설정 링크 발송 → 성공 안내", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "success", requests);

    await page.goto(appUrl("/forgot-password"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="forgot.form-card"]')).toBeVisible();

    await page.locator('[data-el="forgot.email-input"]').fill(RESET_EMAIL);
    await page.locator('[data-el="forgot.submit"]').click();

    await expect(page.locator('[data-el="forgot.sent-message"]')).toBeVisible();
    await expect(page.locator('[data-el="forgot.email-form"]')).toHaveCount(0);

    const reset = requests.find(
      (r) => r.url.includes("request-password-reset") || r.url.includes("forget-password"),
    );
    expect(reset?.method).toBe("POST");
    expect(reset?.postData).toEqual(expect.objectContaining({ email: RESET_EMAIL }));
  });

  test("rate-limit 응답 시 에러 메시지 표시 + 폼 유지", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "rate-limited", requests);

    await page.goto(appUrl("/forgot-password"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-el="forgot.email-input"]').fill(RESET_EMAIL);
    await page.locator('[data-el="forgot.submit"]').click();

    await expect(page.locator('[data-el="forgot.error-message"]')).toBeVisible();
    // 성공 안내는 표시되지 않아야 함
    await expect(page.locator('[data-el="forgot.sent-message"]')).toHaveCount(0);
  });
});
