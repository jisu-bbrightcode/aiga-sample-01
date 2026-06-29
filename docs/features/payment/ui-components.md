# UI 컴포넌트

결제 도메인의 frontend 컴포넌트 전체 카탈로그입니다. 위치: `apps/app/src/features/payment/`

---

## 페이지 (Pages)

### `my-subscription-page.tsx`

**경로:** `/billing/subscription`

사용자의 현재 구독 상태와 관리 도구를 보여줍니다.

- `SubscriptionCard` — 현재 플랜·기간·상태 표시
- `ChangePlanDialog` 열기 버튼 (플랜 변경)
- `CancelDialog` 열기 버튼 (해지 / 환불)
- 해지 예약 중일 때 "해지 취소" 버튼 (`useUncancelSubscription`)
- 다운그레이드 대기 중일 때 예약 정보 + [예약 취소] 표시
- `ExtraUsageCard` — 추가 사용량 설정 카드

---

### `upgrade-page.tsx`

**경로:** `/billing/upgrade`

플랜 선택 및 구독 시작/변경 페이지.

```typescript
// handleSelectPlan 분기 로직
function handleSelectPlan(plan: PlanRow) {
  if (!currentSub || currentSub.status === 'canceled') {
    return startCheckout(plan);   // Free → 유료: Polar checkout
  }
  if (currentSub.planId === plan.id) return;  // noop
  setPendingChangeTarget(plan);   // 유료 → 다른 유료: ChangePlanDialog 오픈
}
```

- `PlanCard` 목록 (Free / Pro / Team)
- PlanCard 의 CTA 라벨이 상황에 따라 동적 변경

---

### `billing-overview-page.tsx`

**경로:** `/billing`

결제 현황 개요 (구독 요약, 최근 인보이스, credit 잔액).

---

### `top-up-page.tsx`

**경로:** `/billing/top-up`

수동 충전 패키지 선택 페이지.

---

### `usage-page.tsx`

**경로:** `/billing/usage`

AI 사용량 이력과 모델별 통계.

---

### `invoices-page.tsx`

**경로:** `/billing/invoices`

인보이스 목록과 Polar 인보이스 URL.

---

### `pricing-page.tsx`

**경로:** `/pricing`

공개 가격 페이지 (인증 불필요, `public.getPlans` 사용).

---

### `checkout-success-page.tsx` / `checkout-cancel-page.tsx`

Polar checkout 완료/취소 후 리디렉트 랜딩 페이지.

---

## 컴포넌트 (Components)

### `plan-card.tsx` — PlanCard

플랜 하나를 카드 형태로 표시합니다.

**Props:**
```typescript
interface PlanCardProps {
  plan: PaymentPlan;
  currentSubscription?: PaymentSubscription | null;
  onSelect: (plan: PaymentPlan) => void;
}
```

**CTA 라벨 분기:**
| 상황 | 라벨 |
|------|------|
| 현재 플랜 | "현재 플랜" (disabled) |
| 가격 높은 플랜 (upgrade) | "업그레이드 · 즉시 ₩X 결제" |
| 가격 낮은 플랜 (downgrade) | "다음 결제일부터 변경" |
| 구독 없음 / 취소됨 | "시작하기" |

---

### `subscription-card.tsx` — SubscriptionCard

현재 구독 정보를 카드로 표시합니다.

**표시 정보:** 플랜 이름 · 상태 배지 · 결제 주기 · 다음 결제일 · cancel_at_period_end 표시.

---

### `change-plan-dialog.tsx` — ChangePlanDialog

플랜 변경 전 확인 다이얼로그 (shadcn `Dialog`).

**흐름:**
1. 마운트 시 `usePreviewPlanChange(targetPlanId)` lazy query
2. `kind=upgrade` → "₩X 즉시 결제 · 확인" 표시
3. `kind=downgrade` → "YYYY-MM-DD 부터 [플랜] 적용 · 확인" 표시
4. 확인 → `useChangePlan().mutate()`

---

### `cancel-dialog.tsx` — CancelDialog

구독 해지 다이얼로그 (shadcn `Dialog`).

**흐름:**
1. `useCancelDialog()` 가 14일 윈도우 체크
2. 14일 이내 → 두 라디오 버튼 표시
3. 14일 이후 → at_period_end 만 표시
4. 선택 후 확인 → `useCancelDialog().submit(mode)`

**에러 처리:** `refund_window_closed` 에러 시 자동으로 `at_period_end` 모드로 fallback + 안내 메시지.

---

### `extra-usage-card.tsx` — ExtraUsageCard

Anthropic Claude for Work 패턴의 추가 사용량 카드.

**UI 구성:**
- 헤더: 토글 (enabled/disabled)
- 사용량 progress bar (이번 cycle 누적 / monthly_limit)
- 다음 재설정 날짜
- 월간 지출 한도 + [한도 조정] 버튼
- 현재 잔액 + [추가 사용량 구매] 버튼

**잔액 갱신:** 30초 interval polling (`useUsageBalance`). 캐시 컬럼 단일 읽기로 성능 최적화.

---

### `limit-dialog.tsx` — LimitDialog

월간 지출 한도 조정 다이얼로그.

**포함 기능:**
- 한도 금액 입력 (slider + input, $1 단위)
- 자동 새로고침 토글
- 자동 충전 threshold 설정
- 자동 충전 패키지 선택 (TODO: v1.1 PackageSelector 완성)
- 확인 → `useUpdateExtraUsageSettings().mutate()`

---

### `credit-balance.tsx` — CreditBalance

Included credit 잔액을 표시하는 인라인 컴포넌트.

---

### `coupon-input.tsx` — CouponInput

checkout 시 쿠폰 코드 입력 컴포넌트.

---

### `usage-meter.tsx` — UsageMeter

AI 사용량 progress bar (ExtraUsageCard 내부에서도 사용).

---

## Hooks

### `use-my-subscription.ts`

```typescript
export function useMySubscription()          // query: getMySubscription
export function useReactivateSubscription()  // mutation
```

---

### `use-plan-change.ts`

```typescript
export function useChangePlan()                              // mutation: changePlan
export function usePreviewPlanChange(targetPlanId: string | null)  // query, lazy
export function useCancelDialog()                            // 14일 검증 + mode 분기
export function useUncancelSubscription()                    // mutation
export function usePendingPlanChange()                       // query: 현재 pending row
export function useCancelPendingChange()                     // mutation: pending 취소
```

---

### `use-extra-usage.ts`

```typescript
export function useExtraUsageSettings()         // query: getSettings
export function useUpdateExtraUsageSettings()   // mutation: updateSettings
export function useUsageBalance()               // query: balance + accumulated (30s interval)
export function useUsageStats(rangeDays: number) // query: getStats
```

---

### `use-checkout.ts`

```typescript
export function useCreateSubscriptionCheckout()   // mutation
export function useCreateTopUpCheckout()          // mutation
```

---

### `use-credits.ts`

```typescript
export function useCreditBalance()    // query
export function useCreditHistory()    // query (paginated)
```

---

### `use-top-up.ts`

```typescript
export function useTriggerManualTopup()   // mutation
```

---

### `use-plans.ts` / `use-invoices.ts` / `use-usage.ts`

각각 플랜 목록, 인보이스 목록, 사용량 통계 query hook.
