# 플랜 변경 흐름 (Plan Change Flows)

사용자가 구독 플랜을 바꾸는 5가지 시나리오와 내부 처리 방식을 설명합니다.

---

## 5 Kind 분류

| Kind | 조건 | Polar 처리 | 적용 시점 | 결제 |
|------|------|-----------|---------|------|
| `upgrade` | 같은 cycle, 더 비싼 플랜 | `proration_behavior: invoice` | 즉시 | 차액 즉시 결제 |
| `cycle-up` | 월간 → 연간 (더 비쌈) | `proration_behavior: invoice` | 즉시 | 연간 금액 즉시 결제 (잔액 크레딧) |
| `cycle-down` | 연간 → 월간 (더 쌈) | `proration_behavior: prorate` | 즉시 | 잔액 다음 청구에 크레딧 |
| `downgrade` | 같은 cycle, 더 싼 플랜 | `proration_behavior: next_period` | cycle_end | 결제 없음 (다음 cycle 부터 새 가격) |
| `noop` | 동일 plan_id | — | — | throw |

**판정 기준:**
1. `targetPlanId === currentPlanId` → noop
2. cycle 이 다르면 → cycle-up 또는 cycle-down (금액 비교로 구분)
3. cycle 이 같고 `targetPlan.priceCents > currentPlan.priceCents` → upgrade
4. cycle 이 같고 `targetPlan.priceCents < currentPlan.priceCents` → downgrade

---

## previewPlanChange

변경 전 사용자에게 미리 정보를 보여줍니다. 사이드이펙트 없음 (query).

```typescript
// tRPC: payment.previewPlanChange
// Input: { targetPlanId: string }
// Returns: PreviewResult

interface PreviewResult {
  kind: "upgrade" | "downgrade" | "cycle-up" | "cycle-down" | "noop";
  prorationCents: number;    // upgrade/cycle-up: 즉시 결제 금액, 나머지: 0
  nextChargeAt: Date;        // 다음 결제일
  effectiveAt: "now" | "cycle_end";
}
```

**일할 비례 계산 (upgrade / cycle-up):**
```
남은 일수 = current_period_end - today
cycle 전체 일수 = current_period_end - current_period_start
비례 잔액 = (남은 일수 / cycle 전체 일수) × 현재 플랜 가격
proration_cents = 새 플랜 가격 - 비례 잔액
```

이 계산은 Polar 에서 실제 청구할 금액과 근사치이며, 정확한 금액은 Polar 가 결정합니다.

---

## changePlanV2 — 즉시 변경 (upgrade / cycle-up / cycle-down)

```
사용자 → ChangePlanDialog 확인
  → tRPC payment.changePlan
  → SubscriptionService.changePlanV2

  [Polar 호출은 tx 밖]
  PolarAdapter.updateSubscription(polar_sub_id, {
    product_id: targetPlan.polarProductId,
    proration_behavior: kind === 'cycle-down' ? 'prorate' : 'invoice',
  })

  [응답 후 tx 안]
  db.transaction(async tx => {
    // 1. DB mirror (plan_id, period dates)
    UPDATE payment_subscriptions SET plan_id=..., current_period_start=...
    // 2. credit 처리
    CreditLedgerService.applyPlanChangeCredit(tx, kind, ...)
    //    - upgrade: INSERT delta=+(new_credits - old_credits)
    //    - cycle-up: 새 cycle credit grant + 기존 잔액 비례 환원
    //    - cycle-down: 새 cycle credit grant + 기존 연간 잔액 비례 환원
    // 3. extra usage settings 월간 한도 갱신 (upgrade 시)
    // 4. Audit log
    AuditService.log('change_plan_v2', { from, to, kind, prorationCents })
  })

  return { effectiveAt: 'now', prorationCents, newPlanId }
```

---

## changePlanV2 — 다운그레이드 (downgrade)

```
사용자 → ChangePlanDialog 확인 (다음 결제일 변경 안내)
  → tRPC payment.changePlan

  db.transaction(async tx => {
    // 기존 pending row 있으면 canceled 마크
    UPDATE payment_pending_plan_changes SET status='canceled', canceled_at=now
      WHERE subscription_id=... AND status='pending'
    // 새 pending row insert
    INSERT payment_pending_plan_changes {
      subscription_id, target_plan_id,
      apply_at: current_period_end,  // 다음 결제일에 적용
      status: 'pending'
    }
    // Audit log
    AuditService.log('schedule_downgrade', ...)
  })

  return { effectiveAt: 'cycle_end', pendingChangeId, newPlanId: currentPlan.id }
```

---

## PendingPlanChangeCron (다운그레이드 자동 적용)

매시간 실행. `status='pending' AND apply_at <= now()` 인 row 처리.

```typescript
@Cron('0 * * * *')
async tick() {
  const due = await db.select()
    .from(paymentPendingPlanChanges)
    .where(and(
      eq(paymentPendingPlanChanges.status, 'pending'),
      lte(paymentPendingPlanChanges.applyAt, new Date()),
    ));

  for (const row of due) {
    // Polar 호출 (tx 밖)
    await polar.updateSubscription(sub.polarSubscriptionId, {
      product_id: plan.polarProductId,
      proration_behavior: 'next_period',
    });
    // DB mirror
    await db.update(paymentPendingPlanChanges)
      .set({ status: 'applied', appliedAt: new Date() });
    await db.update(paymentSubscriptions)
      .set({ planId: row.targetPlanId });
    // Audit log
    audit.log('apply_pending_change', ...);
  }
}
```

**동시성 안전:**
- `uniqueIndex WHERE status='pending'` — sub 당 1건만 pending
- NestJS Scheduler 단일 실행 보장 (overlap 없음)
- Polar retriable error → status 그대로 유지 → 다음 tick 재시도

---

## 예외 처리

| 상황 | 결과 |
|------|------|
| `targetPlanId === currentPlanId` (noop) | throw `'already_on_this_plan'` |
| comp_* sub (admin 발급) | throw `'plan_change_not_supported_for_comp_subscription'` |
| 취소된 구독 | throw `'subscription_not_active'` |
| Polar API 실패 (5xx) | throw `PaymentRetriableError` → 사용자에게 재시도 버튼 |
| 유효하지 않은 targetPlanId | throw `TRPCError NOT_FOUND` |

---

## UI 표시

### ChangePlanDialog

1. `usePreviewPlanChange(targetPlanId)` lazy query 호출
2. `upgrade` / `cycle-up`: "₩X 즉시 결제" + 확인 버튼
3. `downgrade`: "다음 결제일 (YYYY-MM-DD) 부터 [플랜명] 적용" + 확인 버튼
4. `cycle-down`: "연간 → 월간 전환 · 잔액은 다음 청구에 크레딧" + 확인 버튼

### 진행 중인 다운그레이드 표시

구독 페이지에서 pending row 가 있을 때:
> "다음 결제일 (2026-05-27) 부터 Pro 플랜으로 변경 예정 [예약 취소]"

---

## 참조

- 해지 흐름: [cancellation-and-refund.md](./cancellation-and-refund.md)
- Credit 규칙: [credit-and-extra-usage.md#플랜-변경-시-credit-규칙](./credit-and-extra-usage.md)
- API: [api-reference.md#plan-change](./api-reference.md)
- UI 컴포넌트: [ui-components.md#changeplandialog](./ui-components.md)
