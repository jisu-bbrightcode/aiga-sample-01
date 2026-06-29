/**
 * Credit + Extra Usage E2E (Phase 3 / T13)
 *
 * 6 시나리오:
 *   EU1 — ExtraUsageCard 표시 + 토글 on/off
 *   EU2 — 한도 조정 dialog → monthlyLimit 변경
 *   EU3 — 자동 새로고침 dialog → auto_recharge_enabled toggle (package_not_configured warning)
 *   EU4 — Free plan 사용자 카드 hidden
 *   EU5 (skip) — AI usage event → balance 차감 (AI service instrumentation 필요, 별도 PR)
 *   EU6 (skip) — auto-recharge trigger → balance 회복 (sandbox webhook + saved card)
 *
 * POLAR_ACCESS_TOKEN+POLAR_ENV=sandbox 또는 E2E_POLAR_SANDBOX=1 미설정 시 skip.
 *
 * NOTE — 실행은 사용자 sandbox 환경에서:
 *   pnpm --filter app exec playwright test e2e/credit-extra-usage.spec.ts
 */
import { expect, test } from "@playwright/test";

import { signIn } from "./_lib/auth";
import { waitForTrpc } from "./_lib/network";

const QA_EMAIL = "qa@example.com";
const QA_PASSWORD = "m55nSh5t$$";

// ─────────────────────────────────────────────────────────────────
// Polar sandbox 가드 — .env.local 의 POLAR_ACCESS_TOKEN + POLAR_ENV=sandbox
// 또는 명시 POLAR_SANDBOX_TOKEN / E2E_POLAR_SANDBOX=1
// ─────────────────────────────────────────────────────────────────
const SANDBOX_READY =
  !!process.env.POLAR_SANDBOX_TOKEN ||
  (!!process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_ENV === "sandbox") ||
  process.env.E2E_POLAR_SANDBOX === "1";

// ─────────────────────────────────────────────────────────────────
// 로그인 헬퍼 — payment-plan-change.spec.ts 컨벤션 따름
// ─────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────
// Suite — serial: 각 테스트가 이전 상태에 의존
// ─────────────────────────────────────────────────────────────────
test.describe.serial("credit + extra usage @regression @payment @db", () => {
  test.skip(!SANDBOX_READY, "Polar sandbox 미설정 — sandbox 환경에서 실행");

  test.beforeEach(async ({ page }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });
    // Pre-condition: qa@example.com 가 활성 Team · Yearly sub 보유
    // (PR #62 E2E 완료 후 qa 계정 상태 기준)
  });

  // ───────────────────────────────────────────────────────────────
  // EU1: ExtraUsageCard 표시 + 토글 on/off
  // ───────────────────────────────────────────────────────────────
  test("EU1: ExtraUsageCard 표시 + 토글 on/off", async ({ page }) => {
    await page.goto("/billing/subscription");

    // 카드 기본 요소 표시 확인
    await expect(page.getByText("추가 사용량")).toBeVisible();
    await expect(page.getByText(/사용/)).toBeVisible();
    await expect(page.getByText("월간 지출 한도")).toBeVisible();

    // Switch 토글 상태 읽기 + 반전
    const toggle = page.getByRole("switch").first();
    const initialState = await toggle.isChecked();

    const updateResp = waitForTrpc(page, "payment.extraUsage.updateSettings");
    await toggle.click();
    await updateResp;

    // 상태 변경 확인
    await expect(toggle).toBeChecked({ checked: !initialState });

    // 원래 상태로 복원
    const updateResp2 = waitForTrpc(page, "payment.extraUsage.updateSettings");
    await toggle.click();
    await updateResp2;
    await expect(toggle).toBeChecked({ checked: initialState });
  });

  // ───────────────────────────────────────────────────────────────
  // EU2: 한도 조정 dialog → monthlyLimit 변경
  // ───────────────────────────────────────────────────────────────
  test("EU2: 한도 조정 dialog → monthlyLimit 변경", async ({ page }) => {
    await page.goto("/billing/subscription");

    // 한도 조정 dialog 열기
    await page.getByRole("button", { name: "한도 조정" }).click();
    await expect(page.getByText("한도 및 자동 새로고침 설정")).toBeVisible();

    // 한도 입력 변경 ($75)
    const limitInput = page.getByLabel("월간 지출 한도 (US$)");
    await limitInput.fill("75");

    // 저장 → tRPC 호출 대기
    const updateResp = waitForTrpc(page, "payment.extraUsage.updateSettings");
    await page.getByRole("button", { name: "저장" }).click();
    await updateResp;

    // 카드에 변경 금액 반영 확인
    await expect(page.getByText("US$75.00")).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // EU3: 자동 새로고침 dialog → package_not_configured warning + 저장 disabled
  // ───────────────────────────────────────────────────────────────
  test("EU3: 자동 새로고침 토글 → package_not_configured warning", async ({ page }) => {
    await page.goto("/billing/subscription");

    // 한도 조정 dialog 열기
    await page.getByRole("button", { name: "한도 조정" }).click();
    await expect(page.getByText("한도 및 자동 새로고침 설정")).toBeVisible();

    // 자동 새로고침 토글 ON (LimitDialog Switch id="auto-recharge")
    const autoToggle = page.getByLabel("자동 새로고침");
    await autoToggle.click();

    // 잔액 임계값 input 표시 확인
    await expect(page.getByLabel(/잔액 임계값/)).toBeVisible();

    // package 미설정 → warning 메시지 표시 (limit-dialog.tsx C2 패턴)
    await expect(page.getByText(/충전 패키지를 선택/)).toBeVisible();

    // 저장 버튼 disabled 확인
    const saveBtn = page.getByRole("button", { name: "저장" });
    await expect(saveBtn).toBeDisabled();

    // 취소로 dialog 닫기
    await page.getByRole("button", { name: "취소" }).click();
    await expect(page.getByText("한도 및 자동 새로고침 설정")).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // EU4: 활성 sub 없는 사용자 — 카드 hidden
  // qa 계정이 active Pro 이므로 별도 계정 필요 — skip
  // ───────────────────────────────────────────────────────────────
  test("EU4: Free 사용자 카드 hidden", async ({ page }) => {
    test.skip(true, "Free 사용자 시나리오 — 별도 계정 필요");
    // ExtraUsageCard 는 settings/stats 로딩 실패 시 null 반환 (extra-usage-card.tsx L26)
    // Free 계정이면 /billing/subscription 에서 ExtraUsageCard 미표시 확인
    await page.goto("/billing/subscription");
    await expect(page.getByText("추가 사용량")).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // EU5: AI usage event → balance 차감 (AI instrumentation 별도 PR)
  // ───────────────────────────────────────────────────────────────
  test.skip("EU5: AI usage event → balance 차감 (AI instrumentation 필요)", async () => {
    // AI service 가 ai.reserve/claim 호출하는 path 필요 — 별도 PR 후 활성화
  });

  // ───────────────────────────────────────────────────────────────
  // EU6: auto-recharge trigger → balance 회복 (sandbox webhook + saved card)
  // ───────────────────────────────────────────────────────────────
  test.skip("EU6: auto-recharge trigger → balance 회복 (sandbox saved card flow)", async () => {
    // Polar sandbox 의 saved card 또는 manual checkout flow 필요
  });
});
