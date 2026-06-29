# API Reference

결제 도메인의 tRPC endpoint 전체 카탈로그입니다. 모든 auth 엔드포인트는 `requireSession` 미들웨어로 인증하며, `ctx.activeOrganizationId` 를 org 식별자로 사용합니다 (IDOR 차단).

---

## auth.router (인증 사용자)

파일: `packages/features/payment/trpc/auth.router.ts`

---

### 구독 조회

#### `payment.getMySubscription`

활성 구독 정보를 반환합니다. 없으면 null.

```typescript
// Type: query
// Input: 없음
// Returns: PaymentSubscription | null

// 반환 상태 필터: trialing, active, past_due, grace
// canceled 는 반환하지 않음
```

---

#### `payment.getMyCreditBalance`

현재 included credit 잔액과 마지막 변경 메타데이터를 반환합니다.

```typescript
// Type: query
// Input: 없음
// Returns: { balance: number; lastMutation: ... }
```

---

#### `payment.getMyCreditHistory`

Credit ledger 이력을 페이지네이션으로 반환합니다.

```typescript
// Type: query
// Input: { cursor?: string; limit?: number (1-200); reasonFilter?: CreditReason }
// Returns: { rows: PaymentCreditLedgerRow[]; nextCursor?: string }
```

---

#### `payment.getMyUsageStats`

기간별 AI 사용량 통계를 반환합니다.

```typescript
// Type: query
// Input: { rangeDays: number (1-365) }
// Returns: { byModel: Record<string, { inputTokens, outputTokens, cents }> }
```

---

### 결제 시작

#### `payment.createSubscriptionCheckout`

구독 플랜 결제 세션을 시작합니다.

```typescript
// Type: mutation
// Input:
{
  planId: string;          // uuid
  billingCycle: "monthly" | "yearly";
  couponCode?: string;     // 최대 120자
  successUrl: string;      // URL
}
// Returns: { checkoutUrl: string; polarSessionId: string }
// Errors:
//   NOT_FOUND — planId 없음
//   BAD_REQUEST — Free plan 결제 불가
//   BAD_REQUEST — 쿠폰 유효하지 않음
// Idempotency: userId + productId 의 5초 버킷 key
```

---

#### `payment.createTopUpCheckout`

추가 사용량 충전 패키지 결제 세션을 시작합니다.

```typescript
// Type: mutation
// Input:
{
  packageId: string;       // uuid
  couponCode?: string;
  successUrl: string;
}
// Returns: { checkoutUrl: string; polarSessionId: string }
// Errors:
//   NOT_FOUND — packageId 없음
//   BAD_REQUEST — 쿠폰 유효하지 않음
```

---

### 플랜 변경 (Plan Change v2)

#### `payment.previewPlanChange`

변경 전 미리보기 — 사이드이펙트 없음.

```typescript
// Type: query
// Input: { targetPlanId: string }
// Returns:
{
  kind: "upgrade" | "downgrade" | "cycle-up" | "cycle-down" | "noop";
  prorationCents: number;    // upgrade/cycle-up: 즉시 결제 예상액
  nextChargeAt: Date;
  effectiveAt: "now" | "cycle_end";
}
// Errors:
//   NOT_FOUND — targetPlanId 없음
//   BAD_REQUEST — 활성 구독 없음
```

---

#### `payment.changePlan`

플랜을 변경합니다.

```typescript
// Type: mutation
// Input: { targetPlanId: string }
// Returns:
{
  effectiveAt: "now" | "cycle_end";
  prorationCents?: number;
  pendingChangeId?: string;   // downgrade 시
  newPlanId: string;
}
// Errors:
//   BAD_REQUEST — already_on_this_plan
//   BAD_REQUEST — plan_change_not_supported_for_comp_subscription
//   INTERNAL_SERVER_ERROR — Polar API 실패 (retriable)
```

---

#### `payment.cancelSubscription`

구독을 해지합니다.

```typescript
// Type: mutation
// Input:
{
  mode: "at_period_end" | "with_refund";
  reason?: string;    // 최대 500자
}

// mode=at_period_end Returns:
{ effectiveAt: "cycle_end"; cancelAt: Date; refundEligible: boolean }

// mode=with_refund Returns:
{ refundedCents: number; orderId: string }

// Errors:
//   422 (UNPROCESSABLE_CONTENT) — refund_window_closed (14일 초과)
//   BAD_REQUEST — 활성 구독 없음
//   BAD_REQUEST — comp_* 구독 미지원
```

---

#### `payment.uncancelSubscription`

해지 예약을 취소합니다.

```typescript
// Type: mutation
// Input: 없음
// Returns: { ok: true }
// Errors:
//   BAD_REQUEST — cancel_at_period_end=false (이미 정상)
//   BAD_REQUEST — 활성 구독 없음
```

---

#### `payment.reactivateSubscription`

종료된 구독을 재활성화 (새 checkout 시작).

```typescript
// Type: mutation
// Input: { planId: string; successUrl: string }
// Returns: { checkoutUrl: string }
```

---

### Credit / Extra Usage (AI Metering)

#### `payment.ai.reserve`

AI 호출 전 잔액을 예약합니다.

```typescript
// Type: mutation
// Input:
{
  estimateCents: number;   // 예상 사용량
  refId: string;           // AI service 측 idempotency key
}
// Returns: { reservationId: string }
// Errors:
//   402 — insufficient_balance (extra usage 비활성 or 잔액 부족)
//   402 — monthly_limit_reached
//   409 — auto_recharge_already_in_progress
```

---

#### `payment.ai.claim`

AI 호출 성공 후 실제 사용량을 확정합니다.

```typescript
// Type: mutation
// Input:
{
  reservationId: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  model: string;   // 예: "claude-3-5-sonnet-20241022"
}
// Returns: { balanceAfterCents: number }
```

---

#### `payment.ai.cancel`

AI 호출 실패 시 예약을 취소합니다.

```typescript
// Type: mutation
// Input: { reservationId: string }
// Returns: { ok: true }
```

---

#### `payment.extraUsage.getSettings`

현재 extra usage 설정과 잔액을 반환합니다.

```typescript
// Type: query
// Input: 없음
// Returns:
{
  settings: PaymentExtraUsageSettingsRow;
  balance: number;           // cached_paid_balance_cents
  accumulatedCents: number;  // 이번 cycle 누적 사용량
  cycleEnd: Date;
}
```

---

#### `payment.extraUsage.updateSettings`

Extra usage 설정을 변경합니다.

```typescript
// Type: mutation
// Input: (partial)
{
  enabled?: boolean;
  monthlyLimitCents?: number;
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdCents?: number;
  autoRechargePackageId?: string;
  monthlyRechargeCapCount?: number;
  monthlyRechargeCapCents?: number;
}
// Returns: PaymentExtraUsageSettingsRow
// Audit: extra_usage_settings_updated
```

---

#### `payment.extraUsage.getStats`

최근 사용량 이력 (UI graph 용).

```typescript
// Type: query
// Input: { rangeDays?: number }
// Returns: PaymentUsageLedgerRow[]
```

---

#### `payment.extraUsage.triggerManualTopup`

수동 즉시 충전을 트리거합니다.

```typescript
// Type: mutation
// Input: { packageId: string }
// Returns: { checkoutUrl: string }
// Note: createTopUpCheckout 와 동일한 flow,
//       v1.1 에서 customerExternalId orgId 통일 예정
```

---

## admin.router (관리자 전용)

파일: `packages/features/payment/trpc/admin.router.ts`

RBAC 로 보호. `admin` 또는 `super_admin` 역할만 접근 가능.

| Endpoint | 설명 |
|----------|------|
| `admin.payment.compSubscription` | Polar 없이 DB-only 구독 발급 |
| `admin.payment.cancelSubscriptionNow` | 즉시 취소 (환불 없음) |
| `admin.payment.extendTrialEnd` | 체험 기간 연장 |
| `admin.payment.refundOrder` | 주문 환불 처리 |
| `admin.payment.grantCredits` | 크레딧 수동 지급 |
| `admin.payment.createDiscount` | 쿠폰 생성 |
| `admin.payment.getSubscription` | 특정 org 구독 조회 |
| `admin.payment.getLedgerHistory` | 특정 org ledger 조회 |

---

## public.router (인증 불필요)

파일: `packages/features/payment/trpc/public.router.ts`

| Endpoint | 설명 |
|----------|------|
| `public.payment.getPlans` | 공개 플랜 목록 + 가격 |
| `public.payment.getTopUpPackages` | 공개 충전 패키지 목록 |

---

## 에러 코드 매핑

| 에러 코드 | HTTP | 설명 |
|-----------|------|------|
| `insufficient_balance` | 402 | 잔액 부족 |
| `monthly_limit_reached` | 402 | 월간 한도 도달 |
| `refund_window_closed` | 422 | 14일 환불 기간 초과 |
| `already_on_this_plan` | 400 | 동일 플랜 변경 시도 |
| `auto_recharge_already_in_progress` | 409 | 충전 진행 중 |
| `auto_recharge_failed` | 502 | Polar 에러 |
| `free_plan_quota_exhausted` | 402 | Free 플랜 포함 사용량 소진 |
