# 운영 절차 (Operations)

결제 도메인의 일상 점검과 장애 대응 절차를 정리합니다. 상세 runbook: `docs/runbooks/payment-ops.md`.

---

## 환경 정보

| 항목 | 값 |
|------|-----|
| PSP | Polar.sh (MoR) |
| 통화 | USD |
| Sandbox org | `bbrightcode` (id: `c3bbd923-b869-4d78-8b23-1613887f2096`) |
| Webhook endpoint (sandbox) | id: `fd272d73-70e7-4176-9398-a04d4123faca` |
| Catalog SKU | 7개 (Pro/Team × monthly/yearly + top-up 3종) |

---

## 일상 점검

### 매일 확인

```sql
-- 1. 결제 실패 증가 (past_due spike)
SELECT COUNT(*) FROM payment_subscriptions WHERE status = 'past_due';

-- 2. grace 기간 만료 임박 (2일 이내)
SELECT * FROM payment_subscriptions
WHERE status = 'grace' AND grace_ends_at < NOW() + INTERVAL '2 days';

-- 3. stuck recharge (5분 초과 pending)
SELECT * FROM payment_recharge_history
WHERE status = 'pending' AND attempted_at < NOW() - INTERVAL '5 minutes';

-- 4. 다운그레이드 cron 미처리 (2시간 초과)
SELECT * FROM payment_pending_plan_changes
WHERE status = 'pending' AND apply_at < NOW() - INTERVAL '2 hours';
```

---

### 주간 확인

```sql
-- 1. 이번 주 신규 구독
SELECT COUNT(*), plan_id FROM payment_subscriptions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY plan_id;

-- 2. 이번 주 환불
SELECT COUNT(*), SUM(refunded_amount_cents) FROM payment_orders
WHERE status IN ('refunded', 'partially_refunded')
  AND created_at >= NOW() - INTERVAL '7 days';

-- 3. Top auto-recharge org (비정상 충전 빈도 감지)
SELECT organization_id, COUNT(*) AS recharge_count
FROM payment_recharge_history
WHERE status = 'paid' AND period_start >= date_trunc('month', NOW())
GROUP BY organization_id ORDER BY recharge_count DESC LIMIT 10;
```

---

## On-call 시나리오

### Past_due 사용자 급증

**징후:** `payment_subscriptions.status='past_due'` 급증.

**원인:** Polar 결제 게이트웨이 문제 또는 만료 카드 대량 갱신.

**조치:**
1. Polar 상태 페이지 확인 (https://status.polar.sh)
2. 특정 카드사 문제면 → Polar 지원 연락
3. DunningCron 로그 확인 (`[DunningCron]` prefix)
4. 영향받은 사용자에게 이메일 (Resend `soft-suspend` 템플릿)

---

### Webhook 지연

**징후:** Polar 에서는 결제 성공, DB 는 아직 trialing 상태.

**확인:**
```bash
# Polar sandbox 대시보드 → Webhooks → 최근 delivery 상태 확인
# 200 아닌 응답 → 원인 분석
```

**조치:**
1. 컨트롤러 에러 로그 확인
2. 버그 수정 후 redeliver 스크립트 실행 (참조: [webhook-events.md](./webhook-events.md))
3. `payment_subscription_events.polar_event_id` UNIQUE 로 중복 처리 안전

---

### Auto-recharge 실패 대량

**징후:** `payment_recharge_history.status='failed'` 급증.

**조치:**
1. Polar API 상태 확인
2. 해당 org 의 `polar_customer_id` 와 결제 수단 확인
3. 복구:
   ```sql
   UPDATE payment_recharge_history
   SET status = 'cancelled', completed_at = NOW()
   WHERE id = $RECHARGE_ID;
   -- 다음 reserve 시 새 trigger 발사
   ```

---

### Cron stuck (다운그레이드 미처리)

**징후:** `payment_pending_plan_changes` 에 2시간 초과 pending row.

**확인:**
```
[PendingPlanChangeCron] pending plan change tick: applied=0 failed=N
```

**조치:**
1. Polar sub 상태 확인
2. `polarSubscriptionId` 가 comp_* 이면 terminal — 수동 취소:
   ```sql
   UPDATE payment_pending_plan_changes SET status='canceled' WHERE id=$ID;
   ```
3. Polar API 에러면 수동 PATCH 후 row 수동 applied:
   ```sql
   UPDATE payment_pending_plan_changes SET status='applied', applied_at=NOW() WHERE id=$ID;
   UPDATE payment_subscriptions SET plan_id=$TARGET_PLAN_ID WHERE id=$SUB_ID;
   ```

---

### Refund orphan (revoke 후 환불 미완료)

`cancelImmediatelyWithRefund` 에서 revoke 성공 + refund 실패 시 발생.

**감지:** audit_log 에 `cancel_with_refund` 는 없고 Polar 는 revoked 상태.

**복구:**
1. Polar 대시보드에서 sub 상태 확인 (revoked 확인)
2. DB 수동 업데이트:
   ```sql
   UPDATE payment_subscriptions
   SET status='canceled', canceled_at=NOW(), current_period_end=NOW()
   WHERE id=$SUBSCRIPTION_ID;
   ```
3. `admin.refundOrder` 로 수동 환불 처리
4. audit_log 에 `manual_reconcile` 기록

---

## Dunning (결제 실패 처리) 흐름

| 단계 | trigger | 동작 |
|------|---------|------|
| `active` → `past_due` | Polar payment.failed | DunningService.markPastDue + in-app 배너 |
| `past_due` 7일 경과 | DunningCron 03:00 UTC | grace 진입 + soft-suspend + 이메일 |
| `grace` 만료 | DunningCron | canceled + data_purge_at=+30일 |
| cancel 후 30일 | DataPurgeCron 03:30 UTC | 사용자 데이터 read-only archive |

수동 유예 해제: `admin.payment.releaseSoftSuspend` (TODO: 구현 예정).

---

## 유용한 SQL

```sql
-- 사이클별 사용량 리포트 (특정 org)
SELECT date_trunc('day', created_at) AS day,
       SUM(-delta_cents) FILTER (WHERE delta_cents < 0) AS used_cents,
       SUM(delta_cents) FILTER (WHERE reason = 'auto_recharge') AS recharge_cents
FROM payment_usage_ledger
WHERE organization_id = '$ORG_ID'
  AND period_start = '$CURRENT_CYCLE_START'
GROUP BY day ORDER BY day;

-- in-flight reserves
SELECT organization_id, COUNT(*), SUM(estimate_cents) AS reserved_cents
FROM payment_usage_reserves
WHERE status = 'reserved'
GROUP BY organization_id ORDER BY reserved_cents DESC;

-- 이번 달 heavy user
SELECT organization_id, period_start, SUM(-delta_cents) AS used_cents
FROM payment_usage_ledger
WHERE reason = 'ai_usage' AND period_start = date_trunc('month', NOW())
GROUP BY organization_id, period_start ORDER BY used_cents DESC LIMIT 20;
```

---

## Dev DB 초기화 (테스트 후 청소)

```sql
DELETE FROM payment_subscription_events;
DELETE FROM payment_credit_ledger;
DELETE FROM payment_usage_ledger;
DELETE FROM payment_usage_reserves;
DELETE FROM payment_recharge_history;
DELETE FROM payment_extra_usage_settings;
DELETE FROM payment_pending_plan_changes;
DELETE FROM payment_coupon_redemptions;
DELETE FROM payment_subscriptions;
DELETE FROM payment_orders;
DELETE FROM payment_coupons;
DELETE FROM payment_audit_log;
DELETE FROM payment_customers;
-- catalog 테이블(plans, top_up_packages, model_pricing)은 유지
```

---

## 참조

- 상세 runbook: `docs/runbooks/payment-ops.md`
- 관리자 도구: [admin-tools.md](./admin-tools.md)
- Webhook 재전송: [webhook-events.md](./webhook-events.md)
