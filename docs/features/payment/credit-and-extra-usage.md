# Credit · Extra Usage

AI 사용량 과금 시스템의 전체 구조를 설명합니다. Anthropic Claude for Work 의 "추가 사용량" 카드 패턴을 참고해 설계했습니다.

---

## 설계 철학

"AI 사용을 얼마나 썼나?" 를 사용자가 이해하기 쉽게 **달러 단위(cents)** 로 표시합니다. 구독 플랜에 포함된 기본 사용량을 먼저 소진하고, 이후 별도 과금됩니다.

**1 credit = 1 cent (USD)** — included credit 과 paid usage 단위를 통일합니다.

---

## 이중 Ledger 구조

| Ledger | 테이블 | 대상 | Lifecycle |
|--------|--------|------|-----------|
| **Included Credit Ledger** | `payment_credit_ledger` | Plan 포함 크레딧 | 주기 시작 grant → 사용 차감 → 주기 종료 expire |
| **Paid Usage Ledger** | `payment_usage_ledger` | 유료 추가 사용량 | auto-recharge / top-up 충전 → AI 사용 차감 |

두 ledger 를 분리한 이유: included credit 은 plan grant / cycle reset 등 별도 lifecycle 을 가지며, paid usage 는 충전 패키지 결제와 연결됩니다.

---

## 차감 우선순위

AI 사용량이 발생할 때 다음 순서로 처리합니다.

```
1. paymentCreditLedger (included balance) 먼저 차감
   ↓ included balance 소진 시
2. paymentUsageLedger (paid balance) 차감
   ↓ paid balance < threshold 시
3a. auto_recharge_enabled=true → AutoRechargeService.trigger()
3b. auto_recharge_enabled=false → throw 'insufficient_balance'
   ↓ settings.enabled=false 이면
4. throw 'insufficient_balance' (extra usage 비활성)
```

**Free 플랜:** `settings.enabled` 기본값 `false` — AI 사용 시 included balance 만 차감. 소진 후 `'free_plan_quota_exhausted'` throw.

---

## Reserve / Claim 패턴

AI 호출 전후로 잔액을 안전하게 관리합니다.

### Reserve (AI 호출 전)

```typescript
// tRPC: ai.reserve
// Input: { estimate_cents: 200, refId: 'conv_abc:msg_001' }
// Returns: { reservationId }

AiUsageMeterService.reserve(orgId, estimate, refId):
  // 1. 멱등: 기존 'reserved' row 있으면 그대로 반환
  // 2. 잔액 계산:
  //    includedBalance = SUM(paymentCreditLedger.delta)
  //    paidBalance = cached_paid_balance_cents
  //    totalAvailable = includedBalance + paidBalance
  // 3. totalAvailable - estimate < 0 → handleInsufficient
  // 4. 정상 → payment_usage_reserves INSERT (status='reserved', expires_at=now+5min)
```

**Reserve 멱등:** 같은 `refId` 로 두 번 호출 시 기존 예약 그대로 반환.

### Claim (AI 호출 성공 후)

```typescript
// tRPC: ai.claim
// Input: { reservationId, actual_input_tokens, actual_output_tokens, model }

AiUsageMeterService.claim(reservationId, tokens, model):
  actual_cents = model_pricing.calculate(model, input_tokens, output_tokens)

  db.transaction(async tx => {
    // reserve → claimed
    UPDATE payment_usage_reserves SET status='claimed', claimed_actual_cents=actual

    // 차감 우선순위 적용:
    if (includedBalance >= actual_cents) {
      // 전부 included 차감
      CreditLedgerService.insertWithinTx(tx, delta=-actual, reason='spend')
    } else if (includedBalance > 0) {
      // 부분 분할
      CreditLedgerService.insertWithinTx(tx, delta=-includedBalance)
      paymentUsageLedger INSERT delta_cents=-(actual - includedBalance)
    } else {
      // 전부 paid 차감
      paymentUsageLedger INSERT delta_cents=-actual
    }

    // 캐시 갱신
    UPDATE payment_subscriptions SET cached_paid_balance_cents=...
  })

  // 알림 체크
  UsageNotificationService.maybeNotify(orgId, paidBalance, monthly_limit)
```

### Cancel (AI 호출 실패 시)

```typescript
// tRPC: ai.cancel
// Input: { reservationId }

UPDATE payment_usage_reserves SET status='cancelled', cancelled_at=now
// ledger 변경 없음 — 잔액 자동 복원
```

---

## 월간 한도 (Monthly Limit)

| 플랜 | 기본 한도 |
|------|----------|
| Free | 0 (extra usage 비활성) |
| Pro | $50 (5,000 cents) |
| Team | $200 (20,000 cents) |

사용자가 직접 조정 가능 (LimitDialog). 즉시 반영.

**한도 도달 시:**
```
이번 cycle 누적 paid usage ≥ monthly_limit_cents
  → AI reserve → throw 'monthly_limit_reached'
  → UI: "한도에 도달했습니다. 한도 조정 또는 다음 결제일까지 대기"
  → 자동 recharge 도 monthly_limit 초과면 trigger 안 함
```

---

## 80% / 100% 알림

`UsageNotificationService.maybeNotify` 가 claim 후 호출됩니다.

- **80% 도달:** "이번 달 사용량이 한도의 80%에 도달했습니다." (in-app notification)
- **100% 도달:** "한도에 도달했습니다. 한도 조정 또는 다음 결제일까지 대기" (in-app notification)

**cycle 안 중복 방지:** 80% 알림은 이번 결제 주기에 한 번만 발송.

이메일/Slack 알림은 v1.1 follow-up.

---

## 플랜 변경 시 Credit 규칙

`changePlanV2` 안에서 `CreditLedgerService.applyPlanChangeCredit` 이 처리.

| Kind | Included credit 처리 | Extra usage settings |
|------|---------------------|---------------------|
| `upgrade` | 차액 즉시 grant (`plan_change_grant`) | monthly_limit 자동 상향 (plan default 차액 추가) |
| `downgrade` | 즉시 grant 안 함 — cycle_end 후 새 plan 기준 | settings 그대로 (사용자 직접 조정) |
| `cycle-up` (M→Y) | 새 cycle grant + 기존 monthly 잔액 비례 환원 (`plan_change_revoke`) | settings 그대로 |
| `cycle-down` (Y→M) | 새 cycle grant + 기존 yearly 잔액 비례 환원 | settings 그대로 |

---

## ExtraUsageCard UI (Anthropic 패턴)

`apps/app/src/features/payment/components/extra-usage-card.tsx`

```
┌─────────────────────────────────────────────────────────┐
│  추가 사용량                                  [토글 ●]  │
│  한도에 도달했을 때 계속 사용하려면 켜세요.              │
├─────────────────────────────────────────────────────────┤
│  US$13.42 사용  ━━━━━━━━━━━━░░░░░░░  67%                │
│  2026-05-27 에 재설정                                    │
├─────────────────────────────────────────────────────────┤
│  US$50.00  ⓘ                        [한도 조정]         │
│  월간 지출 한도                                          │
├─────────────────────────────────────────────────────────┤
│  US$36.58                  [추가 사용량 구매]            │
│  현재 잔액 · 자동 새로고침 켜짐                          │
└─────────────────────────────────────────────────────────┘
```

**렌더링 위치:** `my-subscription-page.tsx` 의 SubscriptionCard 아래.

**잔액 표시 소스:** `paymentSubscriptions.cached_paid_balance_cents` (30초 polling, SUM 없이 단일 컬럼 읽기).

---

## 참조

- Auto-recharge 상세: [auto-recharge.md](./auto-recharge.md)
- DB 스키마: [data-model.md#payment_usage_ledger](./data-model.md)
- API 엔드포인트: [api-reference.md#credit--extra-usage](./api-reference.md)
- UI: [ui-components.md#extrausagecard](./ui-components.md)
