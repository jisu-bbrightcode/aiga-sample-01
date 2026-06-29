# 자동 충전 (Auto-Recharge)

유료 잔액이 임계값 아래로 떨어지면 설정된 패키지를 자동 결제해 잔액을 보충합니다. OpenAI 표준 자동 충전 패턴을 참고해 설계했습니다.

---

## Trigger 조건

아래 조건이 모두 충족될 때 자동 충전이 시작됩니다.

```typescript
shouldTrigger(settings, currentBalance, estimateRequired, history): boolean {
  // 1. 사용자가 활성화했는가?
  if (!settings.enabled || !settings.auto_recharge_enabled) return false;
  if (!settings.auto_recharge_package_id) return false;

  // 2. 잔액 + 예상 사용 < threshold 인가?
  if (currentBalance - estimateRequired >= settings.auto_recharge_threshold_cents) return false;

  // 3. 이번 달 cap 을 초과하지 않았는가?
  const thisMonthRecharges = history.filter(h =>
    h.period_start === currentPeriodStart && h.status !== 'cancelled');
  if (cap_count && thisMonthRecharges.length >= cap_count) return false;
  if (cap_cents) {
    const thisMonthSum = thisMonthRecharges.reduce((s, h) => s + h.amount_cents, 0);
    if (thisMonthSum + package.amount_cents > cap_cents) return false;
  }

  return true;
}
```

**기본 설정값:**
- threshold: 500 cents ($5.00)
- monthly_recharge_cap_count: 5회
- monthly_recharge_cap_cents: 설정 없음 (선택)

---

## 실행 흐름

```
AI reserve → 잔액 부족 감지
  → ExtraUsageService.handleInsufficient
  → AutoRechargeService.maybeTrigger(orgId)

  [Advisory lock + idempotency (tx 안)]
  db.transaction(async tx => {
    // 1. Advisory lock — 동시 trigger 차단
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`)

    // 2. pending in-flight 검사 — 이미 pending 이면 throw
    if (pending row 있음) throw 'auto_recharge_already_in_progress'

    // 3. 이번 cycle sequence 결정
    const sequence = cycleHistory.length + 1
    const idempotencyKey = `${orgId}:${period_start.toISOString()}:${sequence}`

    // 4. history row INSERT (status=pending)
    INSERT payment_recharge_history { ..., idempotency_key, status: 'pending' }
  })

  [Polar 호출은 tx 밖]
  polar.createCheckout({
    productId: package.polar_product_id,
    customerId: org.polar_customer_id,
    idempotencyKey: history.idempotency_key,
    metadata: { trigger: 'auto_recharge', recharge_history_id: history.id },
  })

  webhook order.paid 도래 →
    payment_usage_ledger INSERT delta_cents=+amount (reason='auto_recharge')
    payment_subscriptions UPDATE cached_paid_balance_cents
    payment_recharge_history UPDATE status='paid', completed_at=now
```

---

## Race 차단 — 3중 방어

| 방어층 | 방법 | 보호 대상 |
|--------|------|-----------|
| Advisory lock | `pg_advisory_xact_lock(hashtext(orgId))` | 동일 org 동시 trigger N개 → 1개만 진행 |
| Pending in-flight 검사 | `status='pending'` row 존재 시 throw | 이전 충전이 완료되기 전 새 trigger 차단 |
| Idempotency key UNIQUE | `(organization_id, idempotency_key)` UNIQUE | 같은 cycle+sequence 의 중복 history row 차단 |

**multi-recharge per cycle 은 허용:** cap_count 내에서 여러 번 충전 가능. 단 동시 in-flight 는 1개만.

---

## Timeout Cron (stuck recharge 처리)

`UsageReserveCron` (10분 간격) 이 함께 처리합니다.

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async sweepStuckRecharges() {
  const stuck = await db.select().from(payment_recharge_history)
    .where(and(
      eq(payment_recharge_history.status, 'pending'),
      lt(payment_recharge_history.attempted_at, subMinutes(now, 5)),
    ));

  for (const row of stuck) {
    await markTimeout(row.id);   // status='timeout', timeout_at=now
    await audit.log('auto_recharge_timeout', ...);
    // 다음 AI reserve 시 새 sequence 로 재시도 가능
  }
}
```

5분이 지나도 `pending` 인 row → `timeout` 처리. webhook 이 늦게 도래해도 order.paid 처리는 진행됩니다.

---

## Webhook → 잔액 충전

`order.paid` webhook 이 도착할 때 `auto_recharge` 메타데이터를 확인해 분기합니다.

```
order.paid webhook
  → OrderMirrorService.handleOrderPaid
  → metadata.trigger === 'auto_recharge'?
      YES:
        payment_recharge_history UPDATE status='paid', polar_order_id=..., completed_at=now
        payment_usage_ledger INSERT delta_cents=+package.amount_cents
                                    reason='auto_recharge', ref_id=order.id
        payment_subscriptions UPDATE cached_paid_balance_cents
      NO (manual top-up):
        payment_usage_ledger INSERT reason='manual_topup'
        (또는 credit_ledger, 플랜에 따라)
```

---

## 에러 매핑

| 에러 | HTTP | 설명 |
|------|------|------|
| `auto_recharge_already_in_progress` | 409 | pending in-flight 충전 진행 중 |
| `auto_recharge_failed` | 502 | Polar checkout 실패 |
| `auto_recharge_cap_exceeded` | 402 | 월간 cap 초과 |
| `auto_recharge_not_configured` | 400 | package_id 없음 |

---

## 운영 확인 사항

- `payment_recharge_history` 에서 `status='timeout'` 증가 추이 모니터링
- `status='failed'` 는 Polar API 에러 → Polar 대시보드 연결 확인
- 같은 org 의 timeout 이 반복되면 Polar customer portal 에서 결제 수단 확인

---

## 참조

- Credit 차감 우선순위: [credit-and-extra-usage.md](./credit-and-extra-usage.md)
- DB 스키마: [data-model.md#payment_recharge_history](./data-model.md)
- Webhook 처리: [webhook-events.md#order-paid](./webhook-events.md)
- 운영 절차: [operations.md](./operations.md)
