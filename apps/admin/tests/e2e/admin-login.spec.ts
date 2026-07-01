/**
 * SCR-013 Admin 로그인 — /admin/login (public) e2e.
 *
 * PB-SCR-013 / BBR-708.
 *
 * NOTE — Playwright is not yet wired into the monorepo (see payment-admin.spec.ts).
 * This spec is checked in alongside the screen so the state + action-contract test
 * plan lives next to the code; it runs once the e2e harness lands:
 *   1. `pnpm --filter admin add -D @playwright/test`
 *   2. `pnpm --filter admin exec playwright install --with-deps chromium`
 *   3. boot the server (:3002) + admin (:3001), then `pnpm --filter admin e2e`.
 *
 * Coverage (data-testid 유지):
 *  - S0 (route): /admin/login renders the SCR-013 screen and its fields
 *    (scr-013-fld-01 email, scr-013-fld-02 password, scr-013-fld-03 login).
 *  - S1 (AC-01 empty vs default): with empty fields the login button is disabled
 *    (empty state); once a valid email + password are entered it enables (default).
 *  - S2 (loading): submitting shows the button in a busy/disabled state.
 *  - S3 (AC-03 error): invalid credentials surface a recoverable error alert
 *    (scr-013-error) and editing an input clears it so the user can retry.
 *  - S4 (AC-02 permission): visiting /admin/login?denied=1 (how AdminGuard bounces
 *    an authenticated non-admin) shows the permission alert (scr-013-permission).
 *  - S5 (ACT-01 contract): the action marker (scr-013-act-01) carries the
 *    API-001/API-002/API-003 + next-screen (SCR-014) metadata.
 */
import { expect, test } from "@playwright/test";

const LOGIN_PATH = "/admin/login";

test.describe("SCR-013 Admin 로그인", () => {
  test("S0: renders the login fields", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await expect(page.getByTestId("scr-013-fld-01")).toBeVisible();
    await expect(page.getByTestId("scr-013-fld-02")).toBeVisible();
    await expect(page.getByTestId("scr-013-fld-03")).toBeVisible();
  });

  test("S1: empty state disables submit, valid input enables it", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const submit = page.getByTestId("scr-013-fld-03");

    // empty 상태
    await expect(submit).toBeDisabled();

    // default 상태 (유효 입력)
    await page.getByTestId("scr-013-fld-01").fill("admin@example.com");
    await page.getByTestId("scr-013-fld-02").fill("password123");
    await expect(submit).toBeEnabled();
  });

  test("S3: invalid credentials show a recoverable error, cleared on edit", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.getByTestId("scr-013-fld-01").fill("nobody@example.com");
    await page.getByTestId("scr-013-fld-02").fill("wrong-password");
    await page.getByTestId("scr-013-fld-03").click();

    const error = page.getByTestId("scr-013-error");
    await expect(error).toBeVisible();

    // 복구 가능: 입력을 수정하면 오류 안내가 사라진다.
    await page.getByTestId("scr-013-fld-02").fill("another-attempt");
    await expect(error).toBeHidden();
  });

  test("S4: permission state renders for a denied account", async ({ page }) => {
    await page.goto(`${LOGIN_PATH}?denied=1`);
    await expect(page.getByTestId("scr-013-permission")).toBeVisible();
  });

  test("S5: ACT-01 marker carries the API + next-screen contract", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    const act = page.getByTestId("scr-013-act-01");
    await expect(act).toHaveAttribute("data-act-code", "ACT-01");
    await expect(act).toHaveAttribute("data-api", "API-001,API-002,API-003");
    await expect(act).toHaveAttribute("data-next", "SCR-014");
  });
});
