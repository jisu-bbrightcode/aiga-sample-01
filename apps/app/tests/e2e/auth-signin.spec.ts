/**
 * Auth sign-in E2E — 로그인 흐름 + magic-link 트리거 + email-not-verified 재발송.
 *
 * 모든 `/api/auth/**` 호출은 page.route 로 mock — DB/메일 없이 frontend
 * 동작만 검증한다 (e2e-against-pg-branch.yml 에 별도 secrets 불필요).
 */
import { expect, test, type Page } from "@playwright/test";

import { type AuthRequest, parsePostData } from "./_lib/auth-mock";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const SIGNIN_EMAIL = "e2e-signin@studio.com";
const SIGNIN_PASSWORD = "password123";
const USER_ID = "e2e-user-signin";




type Scenario =
  | "success"
  | "email-not-verified"
  | "invalid-credentials"
  | "magic-link-success"
  | "magic-link-error";

async function installAuthMock(page: Page, scenario: Scenario, requests: AuthRequest[]) {
  await page.route("**/auth/**", async (route) => {
    const request = route.request();
    const url = request.url();
    requests.push({
      method: request.method(),
      url,
      postData: parsePostData(route),
    });

    if (url.includes("sign-in/email")) {
      if (scenario === "email-not-verified") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ message: "Email not verified", code: "EMAIL_NOT_VERIFIED" }),
        });
        return;
      }
      if (scenario === "invalid-credentials") {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Invalid credentials", code: "INVALID_CREDENTIALS" }),
        });
        return;
      }
      // success
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "e2e-token-1",
          user: {
            id: USER_ID,
            email: SIGNIN_EMAIL,
            name: "E2E SignIn",
            image: null,
            createdAt: new Date("2024-01-01").toISOString(),
            updatedAt: new Date("2024-01-01").toISOString(),
          },
        }),
      });
      return;
    }

    if (url.includes("sign-in/magic-link")) {
      if (scenario === "magic-link-error") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "MAGIC_LINK_FAILED", message: "Magic link failed" },
          }),
        });
        return;
      }
      await fulfillJson(route, { status: true });
      return;
    }

    if (url.includes("send-verification")) {
      await fulfillJson(route, { status: true });
      return;
    }

    // Session/get-session/etc.
    await fulfillJson(route, null);
  });
}

test.describe("Auth sign-in @critical @auth", () => {
  test("email + password 성공 시 토큰을 저장하고 next 경로로 이동한다", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "success", requests);

    await page.goto(appUrl("/sign-in"), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-el="login.form-card"]')).toBeVisible();

    await page.locator('[data-el="login.email-input"]').fill(SIGNIN_EMAIL);
    await page.locator('[data-el="login.password-input"]').fill(SIGNIN_PASSWORD);
    await page.locator('[data-el="login.submit-btn"]').click();

    // navigate 호출 → 더 이상 sign-in 페이지에 머무르지 않음.
    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 5_000 });

    const signinRequest = requests.find((r) => r.url.includes("sign-in/email"));
    expect(signinRequest?.method).toBe("POST");
    expect(signinRequest?.postData).toEqual(
      expect.objectContaining({ email: SIGNIN_EMAIL, password: SIGNIN_PASSWORD }),
    );
  });

  test("EMAIL_NOT_VERIFIED 응답 시 재발송 UI 노출 + 재발송 API 호출", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "email-not-verified", requests);

    await page.goto(appUrl("/sign-in"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-el="login.email-input"]').fill(SIGNIN_EMAIL);
    await page.locator('[data-el="login.password-input"]').fill(SIGNIN_PASSWORD);
    await page.locator('[data-el="login.submit-btn"]').click();

    await expect(page.locator('[data-el="login.email-not-verified"]')).toBeVisible();
    await page.locator('[data-el="login.resend-btn"]').click();
    await expect(page.locator('[data-el="login.resend-sent"]')).toBeVisible();

    const resend = requests.find((r) => r.url.includes("send-verification"));
    expect(resend?.method).toBe("POST");
    expect(resend?.postData).toEqual(expect.objectContaining({ email: SIGNIN_EMAIL }));
  });

  test("자격 증명 오류 시 에러 메시지 표시 + 페이지 유지", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "invalid-credentials", requests);

    await page.goto(appUrl("/sign-in"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-el="login.email-input"]').fill(SIGNIN_EMAIL);
    await page.locator('[data-el="login.password-input"]').fill("wrong-password");
    await page.locator('[data-el="login.submit-btn"]').click();

    await expect(page.locator('[data-el="login.error-message"]')).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Magic Link 발송 성공 시 /magic-link 페이지로 이동", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "magic-link-success", requests);

    await page.goto(appUrl("/sign-in"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-el="login.email-input"]').fill(SIGNIN_EMAIL);
    await page.locator('[data-el="login.magic-link"]').click();

    await expect(page).toHaveURL(/\/magic-link$/);
    await expect(page.locator('[data-el="magic.email-display"]')).toHaveText(SIGNIN_EMAIL);

    await expect(page.evaluate(() => sessionStorage.getItem("product-builder.auth.notice"))).resolves.toBe(
      "magic-link",
    );

    const ml = requests.find((r) => r.url.includes("sign-in/magic-link"));
    expect(ml?.method).toBe("POST");
    expect(ml?.postData).toEqual(
      expect.objectContaining({
        email: SIGNIN_EMAIL,
        callbackURL: "http://localhost:3000/",
      }),
    );
  });

  test("Magic Link 이메일 없이 클릭 시 에러 메시지 표시", async ({ page }) => {
    const requests: AuthRequest[] = [];
    await installAuthMock(page, "magic-link-success", requests);

    await page.goto(appUrl("/sign-in"), { waitUntil: "domcontentloaded" });
    await page.locator('[data-el="login.magic-link"]').click();

    await expect(page.locator('[data-el="login.error-message"]')).toBeVisible();
    // API 호출 없음
    expect(requests.find((r) => r.url.includes("sign-in/magic-link"))).toBeUndefined();
  });
});
