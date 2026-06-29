/**
 * Sign-in 헬퍼 (apps/app).
 *
 * - `data-el="login.*"` 셀렉터 사용 (i18n-agnostic, runbook §2.3).
 * - 실패 시 form-card 텍스트를 throw 메시지에 포함해 진단 향상.
 * - `extraSettleMs` 는 zion-quest 처럼 sidebar mount 까지 추가 대기가 필요한 spec 용.
 */

import type { Page } from "@playwright/test";

export interface SignInOptions {
  email: string;
  password: string;
  /** sign-in submit 이후 추가 settle 대기 (ms). 기본 0. */
  extraSettleMs?: number;
}

export async function signIn(
  page: Page,
  { email, password, extraSettleMs = 0 }: SignInOptions,
): Promise<void> {
  await page.goto("/sign-in");
  await page.locator('[data-el="login.email-input"]').fill(email);
  await page.locator('[data-el="login.password-input"]').fill(password);
  await page.locator('[data-el="login.submit-btn"]').click();
  await page.waitForLoadState("networkidle");

  if (page.url().includes("/sign-in")) {
    const formText = await page
      .locator('[data-el="login.form-card"]')
      .innerText()
      .catch(() => "");
    throw new Error(`sign-in failed for ${email}: ${formText}`);
  }

  if (extraSettleMs > 0) {
    await page.waitForTimeout(extraSettleMs);
  }
}
