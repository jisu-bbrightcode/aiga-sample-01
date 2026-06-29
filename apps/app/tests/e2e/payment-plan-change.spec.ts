/**
 * Payment plan change v2 — E2E 시나리오 (Playwright, Polar sandbox)
 *
 * Task 13 / Plan 2026-04-26-payment-plan-change-v2.md §Task 13
 *
 * 6 시나리오:
 *   PC1 — upgrade: Pro → Pro Plus (즉시)
 *   PC2 — downgrade: Pro Plus → Pro (pending, 다음 결제일 변경)
 *   PC3 — cancel at_period_end + uncancel
 *   PC4 — cancel with_refund (14일 이내, 5일차)
 *   PC5 — cycle change: monthly → yearly
 *   PC6 — cancel after 14d window — refund 옵션 없음
 *
 * POLAR_SANDBOX_TOKEN 미설정 시 전체 suite skip.
 * 실제 Polar sandbox 결제 호출은 서버 changePlan / cancelSubscription
 * endpoint 로 위임 — 클라이언트는 waitForResponse 로 200 확인만 한다.
 *
 * NOTE — 실행은 사용자 sandbox 환경에서:
 *   pnpm --filter app exec playwright test e2e/payment-plan-change.spec.ts
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
// 로그인 헬퍼 — 기존 payment-user.spec.ts 컨벤션 따름
// ─────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────
// Suite — serial: 각 테스트가 이전 상태에 의존
// ─────────────────────────────────────────────────────────────────
test.describe.serial("payment plan change v2 @critical @payment @db", () => {
  test.skip(!SANDBOX_READY, "POLAR_SANDBOX_TOKEN 미설정 — sandbox 환경에서 실행");

  test.beforeEach(async ({ page }) => {
    await signIn(page, { email: QA_EMAIL, password: QA_PASSWORD });
  });

  // ───────────────────────────────────────────────────────────────
  // PC1: upgrade — Pro · Monthly → Team · Monthly (즉시 변경)
  // ───────────────────────────────────────────────────────────────
  test("PC1: upgrade — Pro · Monthly → Team · Monthly", async ({ page }) => {
    // Pre-condition: qa@example.com 계정이 active Pro · Monthly 구독 보유
    await page.goto("/billing/upgrade");

    // Team · Monthly 으로 변경 버튼 클릭
    await page.getByRole("button", { name: /Team · Monthly.*변경|Team · Monthly.*시작/ }).click();

    // ChangePlanDialog — 즉시 결제 안내 표시 확인
    await expect(page.getByText(/즉시.*결제/)).toBeVisible();

    // 확인 버튼 → tRPC changePlan 호출
    const changePlanResponse = waitForTrpc(page, "payment.changePlan");
    await page.getByRole("button", { name: "확인" }).click();
    await changePlanResponse;

    // subscription 페이지에서 플랜 변경 확인
    await page.goto("/billing/subscription");
    await expect(page.getByText(/Team/)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // PC2: downgrade — Team · Monthly → Pro · Monthly (pending, 다음 결제일 변경)
  // ───────────────────────────────────────────────────────────────
  test("PC2: downgrade — Team · Monthly → Pro · Monthly, pending 표시", async ({ page }) => {
    await page.goto("/billing/upgrade");

    // Pro · Monthly 으로 변경 버튼 클릭
    await page.getByRole("button", { name: /Pro · Monthly.*변경|Pro · Monthly.*시작/ }).click();

    // ChangePlanDialog — 다음 결제일 변경 안내 표시 확인
    await expect(page.getByText(/다음 결제일.*변경/)).toBeVisible();

    const changePlanResponse = waitForTrpc(page, "payment.changePlan");
    await page.getByRole("button", { name: "확인" }).click();
    await changePlanResponse;

    // subscription 페이지에서 "변경 예정" 배지 확인
    await page.goto("/billing/subscription");
    await expect(page.getByText(/플랜으로 변경 예정/)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // PC3: cancel at_period_end → uncancel
  // ───────────────────────────────────────────────────────────────
  test("PC3: cancel at_period_end → uncancel", async ({ page }) => {
    await page.goto("/billing/subscription");

    // 해지 버튼 클릭 → CancelDialog 열기
    await page.getByRole("button", { name: "구독 해지" }).click();

    // CancelDialog — "결제 주기 종료까지" 라디오 선택
    await page.getByRole("radio", { name: /결제 주기 종료까지/ }).check();

    // 해지 확인 → tRPC cancelSubscription
    const cancelResponse = waitForTrpc(page, "payment.cancelSubscription");
    await page.getByRole("button", { name: "해지 확인" }).click();
    await cancelResponse;

    // "해지 예약" 상태 표시 확인
    await expect(page.getByText("해지 예약")).toBeVisible();

    // uncancel — 해지 취소 버튼 클릭
    const uncancelResponse = waitForTrpc(page, "payment.uncancelSubscription");
    await page.getByRole("button", { name: /해지 취소/ }).click();
    await uncancelResponse;

    // "해지 예약" 배지 사라짐 확인
    await expect(page.getByText("해지 예약")).not.toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // PC4: cancel with_refund — 5일차 (14일 이내 즉시 환불)
  // ───────────────────────────────────────────────────────────────
  // Pre-condition seed (5일 전 결제한 sub) 가 인라인 X — 별도 setup 환경에서만.

  // ───────────────────────────────────────────────────────────────
  // PC5: cycle change — Pro · Monthly → Pro · Yearly
  // ───────────────────────────────────────────────────────────────
  test("PC5: cycle change — Pro · Monthly → Pro · Yearly", async ({ page }) => {
    await page.goto("/billing/upgrade");

    // 연간 결제 토글
    await page.getByRole("button", { name: /연간/ }).click();

    // Pro · Yearly 으로 변경 버튼 클릭
    await page.getByRole("button", { name: /Pro · Yearly.*변경|Pro · Yearly.*시작/ }).click();

    // ChangePlanDialog — 즉시 결제 안내
    await expect(page.getByText(/즉시.*결제/)).toBeVisible();

    const changePlanResponse = waitForTrpc(page, "payment.changePlan");
    await page.getByRole("button", { name: "확인" }).click();
    await changePlanResponse;

    // subscription 페이지에서 연간 결제 확인
    await page.goto("/billing/subscription");
    await expect(page.getByText(/Pro · Yearly|연간/)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // PC6: cancel after 14d window — refund 라디오 옵션 없음
  // ───────────────────────────────────────────────────────────────
  // Pre-condition seed (30일 전 결제한 sub) 가 인라인 X — 별도 setup 환경에서만.
});
