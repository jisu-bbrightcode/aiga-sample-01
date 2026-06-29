import { expect, test, type Page } from "@playwright/test";

import { type AuthRequest, parsePostData } from "./_lib/auth-mock";
import { appUrl } from "./_lib/env";
import { fulfillJson } from "./_lib/network";

const SIGNUP_EMAIL = "e2e-signup@studio.com";
const SIGNUP_NAME = "E2E User";




async function installAuthMock(page: Page, requests: AuthRequest[]) {
  await page.route("**/auth/**", async (route) => {
    const request = route.request();
    const url = request.url();
    requests.push({
      method: request.method(),
      postData: parsePostData(route),
      url,
    });

    if (url.includes("sign-up")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "e2e-user-1",
            email: SIGNUP_EMAIL,
            name: SIGNUP_NAME,
          },
        }),
      });
      return;
    }

    if (url.includes("send-verification")) {
      await fulfillJson(route, { status: true });
      return;
    }

    await fulfillJson(route, null);
  });
}

test.describe("Auth signup @critical @auth", () => {
  test("email signup shows verification notice and can resend verification email", async ({
    page,
  }) => {
    const authRequests: AuthRequest[] = [];
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await installAuthMock(page, authRequests);

    await page.goto(appUrl("/sign-up"), { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-el="signup.form-card"]')).toBeVisible();
    await page.locator('[data-el="signup.name-input"]').fill(SIGNUP_NAME);
    await page.locator('[data-el="signup.email-input"]').fill(SIGNUP_EMAIL);
    await page.locator('[data-el="signup.password-input"]').fill("password123");
    await page.locator('[data-el="signup.agree-checkbox"]').click();
    await page.locator('[data-el="signup.submit"]').click();

    await expect(page).toHaveURL(/\/magic-link$/);
    await expect(page.locator('[data-el="magic.status-message"]')).toBeVisible();
    await expect(page.locator('[data-el="magic.email-display"]')).toHaveText(SIGNUP_EMAIL);
    await expect(page.locator('[data-el="magic.info-box"]')).toBeVisible();

    await expect(page.evaluate(() => sessionStorage.getItem("product-builder.auth.notice"))).resolves.toBe(
      "verify-email",
    );

    await page.locator('[data-el="magic.resend-btn"]').click();

    await expect(page.locator('[data-el="magic.resend-btn"]')).toBeDisabled();

    const signupRequest = authRequests.find((request) => request.url.includes("sign-up"));
    expect(signupRequest?.method).toBe("POST");
    expect(signupRequest?.postData).toEqual(
      expect.objectContaining({
        callbackURL: "http://localhost:3000/workspace-select?next=/onboarding",
        email: SIGNUP_EMAIL,
        name: SIGNUP_NAME,
        password: "password123",
      }),
    );

    const resendRequest = authRequests.find((request) => request.url.includes("send-verification"));
    expect(resendRequest?.method).toBe("POST");
    expect(resendRequest?.postData).toEqual(
      expect.objectContaining({
        callbackURL: "http://localhost:3000/workspace-select?next=/onboarding",
        email: SIGNUP_EMAIL,
      }),
    );
    expect(consoleErrors).toEqual([]);
  });
});
